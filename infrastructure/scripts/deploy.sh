#!/bin/bash

# Saga Infrastructure Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
      echo "  -e, --environment    Environment to deploy (default: production)"
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

echo -e "${GREEN}🚀 Starting Saga Infrastructure Deployment${NC}"
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

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm install

# Build the CDK app
echo -e "${GREEN}🔨 Building CDK application...${NC}"
npm run build

# Bootstrap CDK if needed
echo -e "${GREEN}🏗️  Bootstrapping CDK (if needed)...${NC}"
npx cdk bootstrap aws://$ACCOUNT_ID/$REGION

# Synthesize the stack
echo -e "${GREEN}🔍 Synthesizing CloudFormation template...${NC}"
npx cdk synth --context environment=$ENVIRONMENT --context region=$REGION

# Deploy the stack
echo -e "${GREEN}🚀 Deploying infrastructure...${NC}"
npx cdk deploy \
  --context environment=$ENVIRONMENT \
  --context region=$REGION \
  --require-approval never \
  --outputs-file outputs.json

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Infrastructure deployment completed successfully!${NC}"
  
  # Display important outputs
  if [ -f "outputs.json" ]; then
    echo -e "${GREEN}📋 Important outputs:${NC}"
    cat outputs.json | jq -r 'to_entries[] | "\(.key): \(.value)"'
  fi
  
  echo -e "${YELLOW}📝 Next steps:${NC}"
  echo "1. Update your application configuration with the output values"
  echo "2. Build and push Docker images to the ECR repositories"
  echo "3. Update ECS services to use the new images"
  echo "4. Configure domain name and SSL certificate (if needed)"
else
  echo -e "${RED}❌ Infrastructure deployment failed!${NC}"
  exit 1
fi