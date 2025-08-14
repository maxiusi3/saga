#!/bin/bash

# Rollback Deployment Script for Saga
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
ROLLBACK_STEPS=1

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
    --steps)
      ROLLBACK_STEPS="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment    Environment (default: production)"
      echo "  -r, --region         AWS region (default: us-east-1)"
      echo "  -s, --service        Service name (api, web, or all)"
      echo "  --steps             Number of versions to rollback (default: 1)"
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
  echo -e "${RED}❌ Service name is required (-s api, -s web, or -s all)${NC}"
  exit 1
fi

echo -e "${GREEN}🔄 Rollback Deployment for Saga${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Service: ${YELLOW}$SERVICE_NAME${NC}"
echo -e "Rollback Steps: ${YELLOW}$ROLLBACK_STEPS${NC}"

CLUSTER_NAME="saga-cluster-$ENVIRONMENT"

# Function to rollback a single service
rollback_service() {
  local service=$1
  local full_service_name="saga-$service-$ENVIRONMENT"
  
  echo -e "${BLUE}🔄 Rolling back service: $full_service_name${NC}"
  
  # Get current service configuration
  CURRENT_SERVICE=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $full_service_name \
    --region $REGION \
    --query 'services[0]' \
    --output json)
  
  if [ "$CURRENT_SERVICE" = "null" ]; then
    echo -e "${RED}❌ Service $full_service_name not found${NC}"
    return 1
  fi
  
  CURRENT_TASK_DEFINITION=$(echo $CURRENT_SERVICE | jq -r '.taskDefinition')
  
  # Extract task definition family and revision
  TASK_FAMILY=$(echo $CURRENT_TASK_DEFINITION | cut -d':' -f6)
  CURRENT_REVISION=$(echo $CURRENT_TASK_DEFINITION | cut -d':' -f7)
  
  echo -e "Current task definition: ${YELLOW}$CURRENT_TASK_DEFINITION${NC}"
  echo -e "Current revision: ${YELLOW}$CURRENT_REVISION${NC}"
  
  # Calculate target revision
  TARGET_REVISION=$((CURRENT_REVISION - ROLLBACK_STEPS))
  
  if [ $TARGET_REVISION -lt 1 ]; then
    echo -e "${RED}❌ Cannot rollback $ROLLBACK_STEPS steps from revision $CURRENT_REVISION${NC}"
    return 1
  fi
  
  TARGET_TASK_DEFINITION="$TASK_FAMILY:$TARGET_REVISION"
  
  echo -e "Target task definition: ${YELLOW}$TARGET_TASK_DEFINITION${NC}"
  
  # Verify target task definition exists
  if ! aws ecs describe-task-definition \
    --task-definition $TARGET_TASK_DEFINITION \
    --region $REGION > /dev/null 2>&1; then
    echo -e "${RED}❌ Target task definition $TARGET_TASK_DEFINITION does not exist${NC}"
    return 1
  fi
  
  # Get target task definition details
  TARGET_TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition $TARGET_TASK_DEFINITION \
    --region $REGION \
    --query 'taskDefinition' \
    --output json)
  
  TARGET_IMAGE=$(echo $TARGET_TASK_DEF | jq -r '.containerDefinitions[0].image')
  
  echo -e "Target image: ${YELLOW}$TARGET_IMAGE${NC}"
  
  # Confirm rollback
  echo -e "${YELLOW}⚠️  This will rollback $full_service_name to revision $TARGET_REVISION${NC}"
  read -p "Are you sure you want to continue? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    return 0
  fi
  
  # Perform rollback
  echo -e "${BLUE}🔄 Updating service to previous revision...${NC}"
  
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $full_service_name \
    --task-definition $TARGET_TASK_DEFINITION \
    --region $REGION > /dev/null
  
  echo -e "${GREEN}✅ Service update initiated${NC}"
  
  # Wait for service to be stable
  echo -e "${BLUE}⏳ Waiting for service to be stable...${NC}"
  
  aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $full_service_name \
    --region $REGION
  
  echo -e "${GREEN}✅ Service rollback completed${NC}"
  
  # Health check
  echo -e "${BLUE}🏥 Running health check...${NC}"
  
  # Get load balancer DNS
  STACK_NAME="SagaInfrastructure-$ENVIRONMENT"
  ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
    --output text \
    --region $REGION)
  
  # Test health endpoint
  if [ "$service" = "api" ]; then
    HEALTH_URL="http://$ALB_DNS/api/health"
  else
    HEALTH_URL="http://$ALB_DNS"
  fi
  
  # Wait a bit for the service to be ready
  sleep 30
  
  if curl -f -s --max-time 10 "$HEALTH_URL" > /dev/null; then
    echo -e "${GREEN}✅ Health check passed for $service${NC}"
  else
    echo -e "${RED}❌ Health check failed for $service${NC}"
    echo -e "${YELLOW}⚠️  Service may still be starting up. Please monitor manually.${NC}"
  fi
  
  # Show rollback summary
  echo -e "${BLUE}📋 Rollback Summary for $service:${NC}"
  echo -e "Previous: ${YELLOW}$CURRENT_TASK_DEFINITION${NC}"
  echo -e "Current:  ${YELLOW}$TARGET_TASK_DEFINITION${NC}"
  echo -e "Image:    ${YELLOW}$TARGET_IMAGE${NC}"
  
  return 0
}

# Main rollback logic
if [ "$SERVICE_NAME" = "all" ]; then
  echo -e "${BLUE}🔄 Rolling back all services...${NC}"
  
  # Rollback API first, then web
  rollback_service "api"
  rollback_service "web"
  
elif [ "$SERVICE_NAME" = "api" ] || [ "$SERVICE_NAME" = "web" ]; then
  rollback_service "$SERVICE_NAME"
  
else
  echo -e "${RED}❌ Invalid service name: $SERVICE_NAME${NC}"
  echo -e "Valid options: api, web, all"
  exit 1
fi

# Final verification
echo -e "${BLUE}🔍 Final verification...${NC}"

# Get load balancer DNS
STACK_NAME="SagaInfrastructure-$ENVIRONMENT"
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region $REGION)

echo -e "${BLUE}🌐 Testing application endpoints...${NC}"

# Test API health
if curl -f -s --max-time 10 "http://$ALB_DNS/api/health" > /dev/null; then
  echo -e "${GREEN}✅ API health check passed${NC}"
else
  echo -e "${YELLOW}⚠️  API health check failed${NC}"
fi

# Test web application
if curl -f -s --max-time 10 "http://$ALB_DNS" > /dev/null; then
  echo -e "${GREEN}✅ Web application check passed${NC}"
else
  echo -e "${YELLOW}⚠️  Web application check failed${NC}"
fi

echo -e "${GREEN}🎉 Rollback process completed!${NC}"

echo -e "${BLUE}📋 Application URLs:${NC}"
echo -e "Web Application: ${YELLOW}http://$ALB_DNS${NC}"
echo -e "API Health: ${YELLOW}http://$ALB_DNS/api/health${NC}"

echo -e "${YELLOW}📝 Post-rollback tasks:${NC}"
echo "1. Monitor application logs for any issues"
echo "2. Run comprehensive smoke tests"
echo "3. Verify all functionality is working correctly"
echo "4. Update monitoring dashboards and alerts"
echo "5. Communicate rollback status to stakeholders"

# Show current service status
echo -e "${BLUE}📊 Current service status:${NC}"

if [ "$SERVICE_NAME" = "all" ] || [ "$SERVICE_NAME" = "api" ]; then
  API_STATUS=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services saga-api-$ENVIRONMENT \
    --region $REGION \
    --query 'services[0].status' \
    --output text)
  
  API_RUNNING=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services saga-api-$ENVIRONMENT \
    --region $REGION \
    --query 'services[0].runningCount' \
    --output text)
  
  echo -e "API Service: ${YELLOW}$API_STATUS${NC} (${YELLOW}$API_RUNNING${NC} running)"
fi

if [ "$SERVICE_NAME" = "all" ] || [ "$SERVICE_NAME" = "web" ]; then
  WEB_STATUS=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services saga-web-$ENVIRONMENT \
    --region $REGION \
    --query 'services[0].status' \
    --output text)
  
  WEB_RUNNING=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services saga-web-$ENVIRONMENT \
    --region $REGION \
    --query 'services[0].runningCount' \
    --output text)
  
  echo -e "Web Service: ${YELLOW}$WEB_STATUS${NC} (${YELLOW}$WEB_RUNNING${NC} running)"
fi

echo -e "${GREEN}🏁 Rollback script completed!${NC}"