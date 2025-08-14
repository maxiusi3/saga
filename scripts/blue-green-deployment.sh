#!/bin/bash

# Blue-Green Deployment Script for Saga
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
REGION="us-east-1"
SERVICE_NAME=""
IMAGE_TAG="latest"
HEALTH_CHECK_TIMEOUT=300
ROLLBACK_ON_FAILURE=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -r|--region)
      REGION="$2"
      shift 2
      ;;
    -s|--service)
      SERVICE_NAME="$2"
      shift 2
      ;;
    -t|--tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --timeout)
      HEALTH_CHECK_TIMEOUT="$2"
      shift 2
      ;;
    --no-rollback)
      ROLLBACK_ON_FAILURE=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment    Environment (default: production)"
      echo "  -r, --region         AWS region (default: us-east-1)"
      echo "  -s, --service        Service name (api or web)"
      echo "  -t, --tag           Image tag (default: latest)"
      echo "  --timeout           Health check timeout in seconds (default: 300)"
      echo "  --no-rollback       Don't rollback on failure"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

if [ -z "$SERVICE_NAME" ]; then
  echo -e "${RED}❌ Service name is required (-s api or -s web)${NC}"
  exit 1
fi

echo -e "${GREEN}🔄 Blue-Green Deployment for Saga${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Service: ${YELLOW}$SERVICE_NAME${NC}"
echo -e "Image Tag: ${YELLOW}$IMAGE_TAG${NC}"

CLUSTER_NAME="saga-cluster-$ENVIRONMENT"
FULL_SERVICE_NAME="saga-$SERVICE_NAME-$ENVIRONMENT"
STACK_NAME="SagaInfrastructure-$ENVIRONMENT"

# Get current service configuration
echo -e "${BLUE}📋 Getting current service configuration...${NC}"

CURRENT_SERVICE=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $FULL_SERVICE_NAME \
  --region $REGION \
  --query 'services[0]' \
  --output json)

if [ "$CURRENT_SERVICE" = "null" ]; then
  echo -e "${RED}❌ Service $FULL_SERVICE_NAME not found${NC}"
  exit 1
fi

CURRENT_TASK_DEFINITION=$(echo $CURRENT_SERVICE | jq -r '.taskDefinition')
CURRENT_DESIRED_COUNT=$(echo $CURRENT_SERVICE | jq -r '.desiredCount')

echo -e "${GREEN}✅ Current service configuration retrieved${NC}"
echo -e "Current task definition: ${YELLOW}$CURRENT_TASK_DEFINITION${NC}"
echo -e "Current desired count: ${YELLOW}$CURRENT_DESIRED_COUNT${NC}"

# Get ECR repository URI
ECR_REPO_URI=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='$(echo $SERVICE_NAME | tr '[:lower:]' '[:upper:]')RepositoryURI'].OutputValue" \
  --output text \
  --region $REGION)

if [ -z "$ECR_REPO_URI" ]; then
  echo -e "${RED}❌ Could not get ECR repository URI${NC}"
  exit 1
fi

NEW_IMAGE="$ECR_REPO_URI:$IMAGE_TAG"
echo -e "New image: ${YELLOW}$NEW_IMAGE${NC}"

# Get current task definition
echo -e "${BLUE}📝 Creating new task definition...${NC}"

CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition $CURRENT_TASK_DEFINITION \
  --region $REGION \
  --query 'taskDefinition' \
  --output json)

# Update image in task definition
NEW_TASK_DEF=$(echo $CURRENT_TASK_DEF | jq --arg image "$NEW_IMAGE" '
  .containerDefinitions[0].image = $image |
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
')

# Register new task definition
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "$NEW_TASK_DEF" \
  --region $REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo -e "${GREEN}✅ New task definition registered: $NEW_TASK_DEF_ARN${NC}"

# Create temporary service for blue-green deployment
TEMP_SERVICE_NAME="$FULL_SERVICE_NAME-temp"

echo -e "${BLUE}🔵 Creating temporary service (Green)...${NC}"

# Get target group ARN
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
  --names "$(echo $FULL_SERVICE_NAME | sed 's/-/_/g')" \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || echo "")

# Create temporary service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name $TEMP_SERVICE_NAME \
  --task-definition $NEW_TASK_DEF_ARN \
  --desired-count $CURRENT_DESIRED_COUNT \
  --launch-type FARGATE \
  --network-configuration "$(echo $CURRENT_SERVICE | jq -r '.networkConfiguration')" \
  --region $REGION > /dev/null

echo -e "${GREEN}✅ Temporary service created${NC}"

# Wait for temporary service to be stable
echo -e "${BLUE}⏳ Waiting for temporary service to be stable...${NC}"

aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $TEMP_SERVICE_NAME \
  --region $REGION

echo -e "${GREEN}✅ Temporary service is stable${NC}"

# Get temporary service tasks
TEMP_TASKS=$(aws ecs list-tasks \
  --cluster $CLUSTER_NAME \
  --service-name $TEMP_SERVICE_NAME \
  --region $REGION \
  --query 'taskArns' \
  --output text)

# Get task IPs for health checks
TEMP_TASK_IPS=()
for task in $TEMP_TASKS; do
  TASK_IP=$(aws ecs describe-tasks \
    --cluster $CLUSTER_NAME \
    --tasks $task \
    --region $REGION \
    --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' \
    --output text)
  TEMP_TASK_IPS+=($TASK_IP)
done

# Health check on temporary service
echo -e "${BLUE}🏥 Running health checks on temporary service...${NC}"

HEALTH_CHECK_PASSED=true
HEALTH_CHECK_START=$(date +%s)

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - HEALTH_CHECK_START))
  
  if [ $ELAPSED -gt $HEALTH_CHECK_TIMEOUT ]; then
    echo -e "${RED}❌ Health check timeout after ${HEALTH_CHECK_TIMEOUT}s${NC}"
    HEALTH_CHECK_PASSED=false
    break
  fi
  
  ALL_HEALTHY=true
  for ip in "${TEMP_TASK_IPS[@]}"; do
    if ! curl -f -s --max-time 5 "http://$ip:3000/health" > /dev/null; then
      ALL_HEALTHY=false
      break
    fi
  done
  
  if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✅ All health checks passed${NC}"
    break
  fi
  
  echo -e "${YELLOW}⏳ Health checks in progress... (${ELAPSED}s/${HEALTH_CHECK_TIMEOUT}s)${NC}"
  sleep 10
done

if [ "$HEALTH_CHECK_PASSED" = false ]; then
  echo -e "${RED}❌ Health checks failed${NC}"
  
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    echo -e "${BLUE}🔄 Rolling back...${NC}"
    
    # Delete temporary service
    aws ecs delete-service \
      --cluster $CLUSTER_NAME \
      --service $TEMP_SERVICE_NAME \
      --force \
      --region $REGION > /dev/null
    
    # Deregister new task definition
    aws ecs deregister-task-definition \
      --task-definition $NEW_TASK_DEF_ARN \
      --region $REGION > /dev/null
    
    echo -e "${GREEN}✅ Rollback completed${NC}"
  fi
  
  exit 1
fi

# Switch traffic to new service
echo -e "${BLUE}🔀 Switching traffic to new service...${NC}"

# Update original service with new task definition
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $FULL_SERVICE_NAME \
  --task-definition $NEW_TASK_DEF_ARN \
  --region $REGION > /dev/null

# Wait for original service to be stable with new task definition
echo -e "${BLUE}⏳ Waiting for service update to complete...${NC}"

aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $FULL_SERVICE_NAME \
  --region $REGION

echo -e "${GREEN}✅ Service update completed${NC}"

# Final health check on updated service
echo -e "${BLUE}🏥 Running final health checks...${NC}"

# Get load balancer DNS
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region $REGION)

# Test through load balancer
if [ "$SERVICE_NAME" = "api" ]; then
  HEALTH_URL="http://$ALB_DNS/api/health"
else
  HEALTH_URL="http://$ALB_DNS"
fi

if curl -f -s --max-time 10 "$HEALTH_URL" > /dev/null; then
  echo -e "${GREEN}✅ Final health check passed${NC}"
else
  echo -e "${RED}❌ Final health check failed${NC}"
  
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    echo -e "${BLUE}🔄 Rolling back to previous version...${NC}"
    
    # Rollback to previous task definition
    aws ecs update-service \
      --cluster $CLUSTER_NAME \
      --service $FULL_SERVICE_NAME \
      --task-definition $CURRENT_TASK_DEFINITION \
      --region $REGION > /dev/null
    
    aws ecs wait services-stable \
      --cluster $CLUSTER_NAME \
      --services $FULL_SERVICE_NAME \
      --region $REGION
    
    echo -e "${GREEN}✅ Rollback completed${NC}"
  fi
  
  # Clean up temporary service
  aws ecs delete-service \
    --cluster $CLUSTER_NAME \
    --service $TEMP_SERVICE_NAME \
    --force \
    --region $REGION > /dev/null
  
  exit 1
fi

# Clean up temporary service
echo -e "${BLUE}🧹 Cleaning up temporary service...${NC}"

aws ecs delete-service \
  --cluster $CLUSTER_NAME \
  --service $TEMP_SERVICE_NAME \
  --force \
  --region $REGION > /dev/null

echo -e "${GREEN}✅ Temporary service cleaned up${NC}"

# Clean up old task definitions (keep last 5)
echo -e "${BLUE}🧹 Cleaning up old task definitions...${NC}"

TASK_FAMILY=$(echo $NEW_TASK_DEF_ARN | cut -d':' -f6)
OLD_TASK_DEFS=$(aws ecs list-task-definitions \
  --family-prefix $TASK_FAMILY \
  --status INACTIVE \
  --sort DESC \
  --region $REGION \
  --query 'taskDefinitionArns[5:]' \
  --output text)

for task_def in $OLD_TASK_DEFS; do
  if [ ! -z "$task_def" ] && [ "$task_def" != "None" ]; then
    aws ecs delete-task-definition \
      --task-definition $task_def \
      --region $REGION > /dev/null
  fi
done

echo -e "${GREEN}🎉 Blue-Green deployment completed successfully!${NC}"
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "Service: ${YELLOW}$FULL_SERVICE_NAME${NC}"
echo -e "New Task Definition: ${YELLOW}$NEW_TASK_DEF_ARN${NC}"
echo -e "New Image: ${YELLOW}$NEW_IMAGE${NC}"
echo -e "Health Check URL: ${YELLOW}$HEALTH_URL${NC}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Monitor application logs for any issues"
echo "2. Run smoke tests to verify functionality"
echo "3. Monitor metrics and alerts"
echo "4. Keep previous task definition for quick rollback if needed"