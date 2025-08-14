#!/bin/bash

# Deployment Validation Script for Saga
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
PROFILE=""

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
    -p|--profile)
      PROFILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment    Environment (default: production)"
      echo "  -r, --region         AWS region (default: us-east-1)"
      echo "  -p, --profile        AWS profile to use"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🔍 Validating Saga deployment${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
  echo -e "AWS Profile: ${YELLOW}$PROFILE${NC}"
fi

STACK_NAME="SagaInfrastructure-$ENVIRONMENT"
VALIDATION_ERRORS=0

echo -e "${BLUE}🏗️  Checking CloudFormation stack...${NC}"

# Check if stack exists and is in good state
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].StackStatus' \
  --output text \
  --region $REGION 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "CREATE_COMPLETE" ] || [ "$STACK_STATUS" = "UPDATE_COMPLETE" ]; then
  echo -e "${GREEN}✅ CloudFormation stack is in good state: $STACK_STATUS${NC}"
else
  echo -e "${RED}❌ CloudFormation stack is not in good state: $STACK_STATUS${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Get stack outputs
echo -e "${BLUE}📋 Getting stack outputs...${NC}"

ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

if [ ! -z "$ALB_DNS" ]; then
  echo -e "${GREEN}✅ Load Balancer DNS: $ALB_DNS${NC}"
else
  echo -e "${RED}❌ Could not get Load Balancer DNS${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Check ECS cluster
echo -e "${BLUE}🐳 Checking ECS cluster...${NC}"

CLUSTER_STATUS=$(aws ecs describe-clusters \
  --clusters saga-cluster-$ENVIRONMENT \
  --query 'clusters[0].status' \
  --output text \
  --region $REGION 2>/dev/null || echo "NOT_FOUND")

if [ "$CLUSTER_STATUS" = "ACTIVE" ]; then
  echo -e "${GREEN}✅ ECS cluster is active${NC}"
else
  echo -e "${RED}❌ ECS cluster is not active: $CLUSTER_STATUS${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Check ECS services
echo -e "${BLUE}🔄 Checking ECS services...${NC}"

API_SERVICE_STATUS=$(aws ecs describe-services \
  --cluster saga-cluster-$ENVIRONMENT \
  --services saga-api-$ENVIRONMENT \
  --query 'services[0].status' \
  --output text \
  --region $REGION 2>/dev/null || echo "NOT_FOUND")

WEB_SERVICE_STATUS=$(aws ecs describe-services \
  --cluster saga-cluster-$ENVIRONMENT \
  --services saga-web-$ENVIRONMENT \
  --query 'services[0].status' \
  --output text \
  --region $REGION 2>/dev/null || echo "NOT_FOUND")

if [ "$API_SERVICE_STATUS" = "ACTIVE" ]; then
  echo -e "${GREEN}✅ API service is active${NC}"
  
  # Check running tasks
  API_RUNNING_COUNT=$(aws ecs describe-services \
    --cluster saga-cluster-$ENVIRONMENT \
    --services saga-api-$ENVIRONMENT \
    --query 'services[0].runningCount' \
    --output text \
    --region $REGION)
  
  API_DESIRED_COUNT=$(aws ecs describe-services \
    --cluster saga-cluster-$ENVIRONMENT \
    --services saga-api-$ENVIRONMENT \
    --query 'services[0].desiredCount' \
    --output text \
    --region $REGION)
  
  if [ "$API_RUNNING_COUNT" = "$API_DESIRED_COUNT" ]; then
    echo -e "${GREEN}✅ API service has $API_RUNNING_COUNT/$API_DESIRED_COUNT tasks running${NC}"
  else
    echo -e "${YELLOW}⚠️  API service has $API_RUNNING_COUNT/$API_DESIRED_COUNT tasks running${NC}"
  fi
else
  echo -e "${RED}❌ API service is not active: $API_SERVICE_STATUS${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

if [ "$WEB_SERVICE_STATUS" = "ACTIVE" ]; then
  echo -e "${GREEN}✅ Web service is active${NC}"
  
  # Check running tasks
  WEB_RUNNING_COUNT=$(aws ecs describe-services \
    --cluster saga-cluster-$ENVIRONMENT \
    --services saga-web-$ENVIRONMENT \
    --query 'services[0].runningCount' \
    --output text \
    --region $REGION)
  
  WEB_DESIRED_COUNT=$(aws ecs describe-services \
    --cluster saga-cluster-$ENVIRONMENT \
    --services saga-web-$ENVIRONMENT \
    --query 'services[0].desiredCount' \
    --output text \
    --region $REGION)
  
  if [ "$WEB_RUNNING_COUNT" = "$WEB_DESIRED_COUNT" ]; then
    echo -e "${GREEN}✅ Web service has $WEB_RUNNING_COUNT/$WEB_DESIRED_COUNT tasks running${NC}"
  else
    echo -e "${YELLOW}⚠️  Web service has $WEB_RUNNING_COUNT/$WEB_DESIRED_COUNT tasks running${NC}"
  fi
else
  echo -e "${RED}❌ Web service is not active: $WEB_SERVICE_STATUS${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Check RDS database
echo -e "${BLUE}🗄️  Checking RDS database...${NC}"

if [ ! -z "$DB_ENDPOINT" ]; then
  DB_STATUS=$(aws rds describe-db-instances \
    --query "DBInstances[?contains(DBInstanceIdentifier, 'saga') && contains(DBInstanceIdentifier, '$ENVIRONMENT')].DBInstanceStatus" \
    --output text \
    --region $REGION 2>/dev/null || echo "NOT_FOUND")
  
  if [ "$DB_STATUS" = "available" ]; then
    echo -e "${GREEN}✅ RDS database is available${NC}"
  else
    echo -e "${RED}❌ RDS database is not available: $DB_STATUS${NC}"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
  fi
else
  echo -e "${RED}❌ Could not get database endpoint${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Check Redis cluster
echo -e "${BLUE}🔴 Checking Redis cluster...${NC}"

if [ ! -z "$REDIS_ENDPOINT" ]; then
  REDIS_STATUS=$(aws elasticache describe-cache-clusters \
    --query "CacheClusters[?contains(CacheClusterId, 'saga') && contains(CacheClusterId, '$ENVIRONMENT')].CacheClusterStatus" \
    --output text \
    --region $REGION 2>/dev/null || echo "NOT_FOUND")
  
  if [ "$REDIS_STATUS" = "available" ]; then
    echo -e "${GREEN}✅ Redis cluster is available${NC}"
  else
    echo -e "${RED}❌ Redis cluster is not available: $REDIS_STATUS${NC}"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
  fi
else
  echo -e "${RED}❌ Could not get Redis endpoint${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Check S3 bucket
echo -e "${BLUE}📦 Checking S3 bucket...${NC}"

if [ ! -z "$S3_BUCKET" ]; then
  if aws s3 ls s3://$S3_BUCKET > /dev/null 2>&1; then
    echo -e "${GREEN}✅ S3 bucket is accessible${NC}"
  else
    echo -e "${RED}❌ S3 bucket is not accessible${NC}"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
  fi
else
  echo -e "${RED}❌ Could not get S3 bucket name${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Test application endpoints
echo -e "${BLUE}🌐 Testing application endpoints...${NC}"

if [ ! -z "$ALB_DNS" ]; then
  # Test health endpoint
  echo -e "${BLUE}🏥 Testing health endpoint...${NC}"
  
  if curl -f -s --max-time 10 "http://$ALB_DNS/api/health" > /dev/null; then
    echo -e "${GREEN}✅ API health endpoint is responding${NC}"
  else
    echo -e "${YELLOW}⚠️  API health endpoint is not responding (this might be expected if the app is still starting)${NC}"
  fi
  
  # Test web application
  echo -e "${BLUE}🌍 Testing web application...${NC}"
  
  if curl -f -s --max-time 10 "http://$ALB_DNS" > /dev/null; then
    echo -e "${GREEN}✅ Web application is responding${NC}"
  else
    echo -e "${YELLOW}⚠️  Web application is not responding (this might be expected if the app is still starting)${NC}"
  fi
else
  echo -e "${RED}❌ Cannot test endpoints without load balancer DNS${NC}"
  VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Check CloudWatch logs
echo -e "${BLUE}📝 Checking CloudWatch logs...${NC}"

API_LOG_STREAMS=$(aws logs describe-log-streams \
  --log-group-name "/ecs/saga-api-$ENVIRONMENT" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

if [ ! -z "$API_LOG_STREAMS" ] && [ "$API_LOG_STREAMS" != "None" ]; then
  echo -e "${GREEN}✅ API logs are being generated${NC}"
else
  echo -e "${YELLOW}⚠️  No recent API log streams found${NC}"
fi

WEB_LOG_STREAMS=$(aws logs describe-log-streams \
  --log-group-name "/ecs/saga-web-$ENVIRONMENT" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

if [ ! -z "$WEB_LOG_STREAMS" ] && [ "$WEB_LOG_STREAMS" != "None" ]; then
  echo -e "${GREEN}✅ Web logs are being generated${NC}"
else
  echo -e "${YELLOW}⚠️  No recent web log streams found${NC}"
fi

# Summary
echo -e "${BLUE}📊 Deployment Validation Summary${NC}"
echo -e "=================================="

if [ $VALIDATION_ERRORS -eq 0 ]; then
  echo -e "${GREEN}🎉 Deployment validation passed! All systems are operational.${NC}"
else
  echo -e "${RED}⚠️  Deployment validation found $VALIDATION_ERRORS issues.${NC}"
fi

echo -e "${BLUE}📋 Deployment Information:${NC}"
echo -e "Load Balancer: ${YELLOW}http://$ALB_DNS${NC}"
echo -e "API Endpoint: ${YELLOW}http://$ALB_DNS/api${NC}"
echo -e "Database: ${YELLOW}$DB_ENDPOINT${NC}"
echo -e "Redis: ${YELLOW}$REDIS_ENDPOINT${NC}"
echo -e "S3 Bucket: ${YELLOW}$S3_BUCKET${NC}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Configure your domain name and SSL certificate"
echo "2. Update application secrets with production values"
echo "3. Run database migrations"
echo "4. Set up monitoring and alerting"
echo "5. Perform load testing"
echo "6. Configure backup and disaster recovery"

echo -e "${GREEN}🏁 Validation completed!${NC}"

exit $VALIDATION_ERRORS