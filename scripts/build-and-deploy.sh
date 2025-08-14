#!/bin/bash

# Saga Build and Deploy Script
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
SKIP_INFRASTRUCTURE=false
SKIP_BUILD=false

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
    --skip-infrastructure)
      SKIP_INFRASTRUCTURE=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment       Environment to deploy (default: production)"
      echo "  -r, --region           AWS region (default: us-east-1)"
      echo "  -p, --profile          AWS profile to use"
      echo "  --skip-infrastructure  Skip infrastructure deployment"
      echo "  --skip-build          Skip Docker image building"
      echo "  -h, --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 Starting Saga Full Deployment${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
  echo -e "AWS Profile: ${YELLOW}$PROFILE${NC}"
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo -e "${RED}❌ AWS CLI is not configured or credentials are invalid${NC}"
  exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "AWS Account: ${YELLOW}$ACCOUNT_ID${NC}"

# Deploy infrastructure if not skipped
if [ "$SKIP_INFRASTRUCTURE" = false ]; then
  echo -e "${BLUE}🏗️  Deploying infrastructure...${NC}"
  cd infrastructure
  ./scripts/deploy.sh -e $ENVIRONMENT -r $REGION $([ ! -z "$PROFILE" ] && echo "-p $PROFILE")
  cd ..
  
  # Wait for infrastructure to be ready
  echo -e "${YELLOW}⏳ Waiting for infrastructure to be ready...${NC}"
  sleep 30
fi

# Get infrastructure outputs
echo -e "${BLUE}📋 Getting infrastructure outputs...${NC}"
STACK_NAME="SagaInfrastructure-$ENVIRONMENT"

# Get ECR repository URIs
API_REPO_URI=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`APIRepositoryURI`].OutputValue' \
  --output text \
  --region $REGION)

WEB_REPO_URI=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`WebRepositoryURI`].OutputValue' \
  --output text \
  --region $REGION)

if [ -z "$API_REPO_URI" ] || [ -z "$WEB_REPO_URI" ]; then
  echo -e "${RED}❌ Failed to get ECR repository URIs from CloudFormation stack${NC}"
  exit 1
fi

echo -e "API Repository: ${YELLOW}$API_REPO_URI${NC}"
echo -e "Web Repository: ${YELLOW}$WEB_REPO_URI${NC}"

# Build and push Docker images if not skipped
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${BLUE}🐳 Building and pushing Docker images...${NC}"
  
  # Login to ECR
  echo -e "${GREEN}🔐 Logging in to ECR...${NC}"
  aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
  
  # Build and push API image
  echo -e "${GREEN}🔨 Building API image...${NC}"
  docker build -f packages/backend/Dockerfile.production -t saga-api:latest .
  docker tag saga-api:latest $API_REPO_URI:latest
  docker tag saga-api:latest $API_REPO_URI:$(date +%Y%m%d-%H%M%S)
  
  echo -e "${GREEN}📤 Pushing API image...${NC}"
  docker push $API_REPO_URI:latest
  docker push $API_REPO_URI:$(date +%Y%m%d-%H%M%S)
  
  # Build and push Web image
  echo -e "${GREEN}🔨 Building Web image...${NC}"
  docker build -f packages/web/Dockerfile.production -t saga-web:latest .
  docker tag saga-web:latest $WEB_REPO_URI:latest
  docker tag saga-web:latest $WEB_REPO_URI:$(date +%Y%m%d-%H%M%S)
  
  echo -e "${GREEN}📤 Pushing Web image...${NC}"
  docker push $WEB_REPO_URI:latest
  docker push $WEB_REPO_URI:$(date +%Y%m%d-%H%M%S)
fi

# Update ECS services
echo -e "${BLUE}🔄 Updating ECS services...${NC}"

# Force new deployment of API service
aws ecs update-service \
  --cluster saga-cluster-$ENVIRONMENT \
  --service saga-api-$ENVIRONMENT \
  --force-new-deployment \
  --region $REGION > /dev/null

# Force new deployment of Web service
aws ecs update-service \
  --cluster saga-cluster-$ENVIRONMENT \
  --service saga-web-$ENVIRONMENT \
  --force-new-deployment \
  --region $REGION > /dev/null

echo -e "${GREEN}✅ ECS services update initiated${NC}"

# Wait for services to be stable
echo -e "${YELLOW}⏳ Waiting for services to be stable...${NC}"
aws ecs wait services-stable \
  --cluster saga-cluster-$ENVIRONMENT \
  --services saga-api-$ENVIRONMENT saga-web-$ENVIRONMENT \
  --region $REGION

echo -e "${GREEN}✅ All services are stable${NC}"

# Get load balancer DNS
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region $REGION)

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📋 Application URLs:${NC}"
echo -e "Web Application: ${YELLOW}http://$ALB_DNS${NC}"
echo -e "API Endpoint: ${YELLOW}http://$ALB_DNS/api${NC}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Configure your domain name to point to the load balancer"
echo "2. Set up SSL certificate for HTTPS"
echo "3. Update application secrets in AWS Secrets Manager"
echo "4. Run database migrations"
echo "5. Configure monitoring and alerting"

# Clean up local Docker images
echo -e "${BLUE}🧹 Cleaning up local Docker images...${NC}"
docker rmi saga-api:latest saga-web:latest 2>/dev/null || true

echo -e "${GREEN}🏁 Deployment script completed!${NC}"