#!/bin/bash

# Complete Deployment Script for Saga Infrastructure
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
EMAIL=""
DOMAIN=""
SKIP_VALIDATION=false
SKIP_MONITORING=false
SKIP_SECURITY=false

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
    --email)
      EMAIL="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    --skip-monitoring)
      SKIP_MONITORING=true
      shift
      ;;
    --skip-security)
      SKIP_SECURITY=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment       Environment (default: production)"
      echo "  -r, --region           AWS region (default: us-east-1)"
      echo "  -p, --profile          AWS profile to use"
      echo "  --email               Email for monitoring alerts"
      echo "  --domain              Domain name for SSL setup"
      echo "  --skip-validation     Skip deployment validation"
      echo "  --skip-monitoring     Skip monitoring setup"
      echo "  --skip-security       Skip security audit"
      echo "  -h, --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 Starting complete Saga deployment${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
  echo -e "AWS Profile: ${YELLOW}$PROFILE${NC}"
fi

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}📋 Deployment Plan:${NC}"
echo "1. Deploy infrastructure"
echo "2. Build and deploy applications"
echo "3. Run deployment validation"
echo "4. Set up monitoring and alerting"
echo "5. Run security audit"
echo "6. Set up SSL (if domain provided)"

read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Deployment cancelled${NC}"
  exit 0
fi

# Step 1: Deploy infrastructure
echo -e "${GREEN}🏗️  Step 1: Deploying infrastructure...${NC}"
cd "$INFRA_DIR"
./scripts/deploy.sh -e $ENVIRONMENT -r $REGION $([ ! -z "$PROFILE" ] && echo "-p $PROFILE")

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Infrastructure deployment failed${NC}"
  exit 1
fi

# Step 2: Build and deploy applications
echo -e "${GREEN}🐳 Step 2: Building and deploying applications...${NC}"
cd "$(dirname "$INFRA_DIR")"
./scripts/build-and-deploy.sh -e $ENVIRONMENT -r $REGION $([ ! -z "$PROFILE" ] && echo "-p $PROFILE") --skip-infrastructure

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Application deployment failed${NC}"
  exit 1
fi

# Step 3: Run deployment validation
if [ "$SKIP_VALIDATION" = false ]; then
  echo -e "${GREEN}🔍 Step 3: Running deployment validation...${NC}"
  cd "$INFRA_DIR"
  ./scripts/deployment-validation.sh -e $ENVIRONMENT -r $REGION $([ ! -z "$PROFILE" ] && echo "-p $PROFILE")
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Deployment validation found issues, but continuing...${NC}"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping deployment validation${NC}"
fi

# Step 4: Set up monitoring
if [ "$SKIP_MONITORING" = false ]; then
  if [ ! -z "$EMAIL" ]; then
    echo -e "${GREEN}📊 Step 4: Setting up monitoring and alerting...${NC}"
    cd "$INFRA_DIR"
    ./scripts/monitoring-setup.sh -e $ENVIRONMENT -r $REGION $([ ! -z "$PROFILE" ] && echo "-p $PROFILE") --email $EMAIL
    
    if [ $? -ne 0 ]; then
      echo -e "${YELLOW}⚠️  Monitoring setup had issues, but continuing...${NC}"
    fi
  else
    echo -e "${YELLOW}⏭️  Skipping monitoring setup (no email provided)${NC}"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping monitoring setup${NC}"
fi

# Step 5: Run security audit
if [ "$SKIP_SECURITY" = false ]; then
  echo -e "${GREEN}🔒 Step 5: Running security audit...${NC}"
  cd "$INFRA_DIR"
  ./scripts/security-audit.sh -e $ENVIRONMENT -r $REGION $([ ! -z "$PROFILE" ] && echo "-p $PROFILE")
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Security audit found issues, please review${NC}"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping security audit${NC}"
fi

# Step 6: Set up SSL
if [ ! -z "$DOMAIN" ]; then
  echo -e "${GREEN}🔒 Step 6: Setting up SSL certificate...${NC}"
  cd "$INFRA_DIR"
  ./scripts/setup-ssl.sh -d $DOMAIN -e $ENVIRONMENT -r $REGION $([ ! -z "$PROFILE" ] && echo "-p $PROFILE")
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  SSL setup had issues, please review${NC}"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping SSL setup (no domain provided)${NC}"
fi

# Get final deployment information
echo -e "${GREEN}📋 Getting deployment information...${NC}"
STACK_NAME="SagaInfrastructure-$ENVIRONMENT"

ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

API_REPO=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`APIRepositoryURI`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

WEB_REPO=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`WebRepositoryURI`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

# Final summary
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "=================================="
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Load Balancer: ${YELLOW}http://$ALB_DNS${NC}"
echo -e "Web Application: ${YELLOW}http://$ALB_DNS${NC}"
echo -e "API Endpoint: ${YELLOW}http://$ALB_DNS/api${NC}"
echo -e "S3 Bucket: ${YELLOW}$S3_BUCKET${NC}"
echo -e "API Repository: ${YELLOW}$API_REPO${NC}"
echo -e "Web Repository: ${YELLOW}$WEB_REPO${NC}"

if [ ! -z "$DOMAIN" ]; then
  echo -e "Domain: ${YELLOW}https://$DOMAIN${NC}"
fi

echo -e "${YELLOW}📝 Post-deployment tasks:${NC}"
echo "1. Update DNS records to point to the load balancer"
echo "2. Configure application secrets with production values"
echo "3. Run database migrations"
echo "4. Test all application functionality"
echo "5. Set up backup and disaster recovery procedures"
echo "6. Configure monitoring dashboards and alerts"
echo "7. Perform load testing"
echo "8. Update documentation with deployment details"

echo -e "${BLUE}🔗 Useful links:${NC}"
echo -e "AWS Console: ${YELLOW}https://console.aws.amazon.com/${NC}"
echo -e "CloudFormation: ${YELLOW}https://$REGION.console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks${NC}"
echo -e "ECS Console: ${YELLOW}https://$REGION.console.aws.amazon.com/ecs/home?region=$REGION#/clusters${NC}"
echo -e "CloudWatch: ${YELLOW}https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION${NC}"

echo -e "${GREEN}🏁 Complete deployment finished!${NC}"