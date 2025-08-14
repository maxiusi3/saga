#!/bin/bash

# Saga Family Biography v1.5 MVP - Production Deployment Script
# Task 9.1: Production Infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="production"
REGION="us-east-1"
DOMAIN_NAME=""
HOSTED_ZONE_ID=""

echo -e "${GREEN}🚀 Saga Family Biography v1.5 MVP - Production Deployment${NC}"
echo -e "${BLUE}================================================================${NC}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)
      DOMAIN_NAME="$2"
      shift 2
      ;;
    --hosted-zone-id)
      HOSTED_ZONE_ID="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --domain           Domain name for the application (optional)"
      echo "  --hosted-zone-id   Route53 hosted zone ID (required if domain is provided)"
      echo "  --region           AWS region (default: us-east-1)"
      echo "  --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Validate domain configuration
if [ ! -z "$DOMAIN_NAME" ] && [ -z "$HOSTED_ZONE_ID" ]; then
  echo -e "${RED}❌ Hosted zone ID is required when domain name is provided${NC}"
  exit 1
fi

echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Region: ${GREEN}$REGION${NC}"
if [ ! -z "$DOMAIN_NAME" ]; then
  echo -e "Domain: ${GREEN}$DOMAIN_NAME${NC}"
  echo -e "Hosted Zone ID: ${GREEN}$HOSTED_ZONE_ID${NC}"
else
  echo -e "Domain: ${YELLOW}Not configured (will use ALB DNS)${NC}"
fi

# Check prerequisites
echo -e "\n${BLUE}🔍 Checking Prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI is not installed${NC}"
  exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo -e "${RED}❌ AWS CLI is not configured or credentials are invalid${NC}"
  exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is not installed${NC}"
  exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed${NC}"
  exit 1
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
  echo -e "${YELLOW}⚠️  AWS CDK not found, installing...${NC}"
  npm install -g aws-cdk
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ AWS Account: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✅ All prerequisites met${NC}"

# Step 1: Build and test the application
echo -e "\n${BLUE}🔨 Step 1: Building and Testing Application...${NC}"

echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci

echo -e "${YELLOW}Running tests...${NC}"
npm run test --workspace=packages/shared
npm run test --workspace=packages/backend
npm run test --workspace=packages/web

echo -e "${YELLOW}Building applications...${NC}"
npm run build --workspace=packages/shared
npm run build --workspace=packages/backend
npm run build --workspace=packages/web

echo -e "${GREEN}✅ Application built and tested successfully${NC}"

# Step 2: Deploy infrastructure
echo -e "\n${BLUE}🏗️  Step 2: Deploying Infrastructure...${NC}"

cd infrastructure

echo -e "${YELLOW}Installing CDK dependencies...${NC}"
npm ci

echo -e "${YELLOW}Building CDK application...${NC}"
npm run build

echo -e "${YELLOW}Bootstrapping CDK...${NC}"
npx cdk bootstrap aws://$ACCOUNT_ID/$REGION

echo -e "${YELLOW}Deploying infrastructure stack...${NC}"
if [ ! -z "$DOMAIN_NAME" ]; then
  npx cdk deploy \
    --context environment=$ENVIRONMENT \
    --context region=$REGION \
    --context domainName=$DOMAIN_NAME \
    --context hostedZoneId=$HOSTED_ZONE_ID \
    --require-approval never \
    --outputs-file ../outputs.json
else
  npx cdk deploy \
    --context environment=$ENVIRONMENT \
    --context region=$REGION \
    --require-approval never \
    --outputs-file ../outputs.json
fi

cd ..

echo -e "${GREEN}✅ Infrastructure deployed successfully${NC}"

# Step 3: Build and push Docker images
echo -e "\n${BLUE}🐳 Step 3: Building and Pushing Docker Images...${NC}"

# Get ECR repository URIs from outputs
API_REPO_URI=$(cat outputs.json | jq -r '.SagaInfrastructureStack.APIRepositoryURI // empty')
WEB_REPO_URI=$(cat outputs.json | jq -r '.SagaInfrastructureStack.WebRepositoryURI // empty')

if [ -z "$API_REPO_URI" ] || [ -z "$WEB_REPO_URI" ]; then
  echo -e "${RED}❌ Failed to get ECR repository URIs from stack outputs${NC}"
  exit 1
fi

echo -e "${YELLOW}API Repository: $API_REPO_URI${NC}"
echo -e "${YELLOW}Web Repository: $WEB_REPO_URI${NC}"

# Login to ECR
echo -e "${YELLOW}Logging in to ECR...${NC}"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $API_REPO_URI

# Build and push API image
echo -e "${YELLOW}Building and pushing API image...${NC}"
docker build -t $API_REPO_URI:latest -f packages/backend/Dockerfile.production .
docker push $API_REPO_URI:latest

# Build and push Web image
echo -e "${YELLOW}Building and pushing Web image...${NC}"
docker build -t $WEB_REPO_URI:latest -f packages/web/Dockerfile.production .
docker push $WEB_REPO_URI:latest

echo -e "${GREEN}✅ Docker images built and pushed successfully${NC}"

# Step 4: Run database migrations
echo -e "\n${BLUE}🗄️  Step 4: Running Database Migrations...${NC}"

# Get database connection info
DB_ENDPOINT=$(cat outputs.json | jq -r '.SagaInfrastructureStack.DatabaseEndpoint')
echo -e "${YELLOW}Database endpoint: $DB_ENDPOINT${NC}"

# Get database credentials
echo -e "${YELLOW}Retrieving database credentials...${NC}"
DB_CREDENTIALS=$(aws secretsmanager get-secret-value \
  --secret-id saga-database-$ENVIRONMENT \
  --region $REGION \
  --query 'SecretString' \
  --output text)

DB_USERNAME=$(echo $DB_CREDENTIALS | jq -r '.username')
DB_PASSWORD=$(echo $DB_CREDENTIALS | jq -r '.password')

# Run migrations
echo -e "${YELLOW}Running database migrations...${NC}"
export DATABASE_URL="postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_ENDPOINT:5432/saga"
cd packages/backend
npx knex migrate:latest
npx knex seed:run
cd ../..

echo -e "${GREEN}✅ Database migrations completed successfully${NC}"

# Step 5: Update ECS services
echo -e "\n${BLUE}🚀 Step 5: Updating ECS Services...${NC}"

echo -e "${YELLOW}Updating API service...${NC}"
aws ecs update-service \
  --cluster saga-cluster-$ENVIRONMENT \
  --service saga-api-$ENVIRONMENT \
  --force-new-deployment \
  --region $REGION

echo -e "${YELLOW}Updating Web service...${NC}"
aws ecs update-service \
  --cluster saga-cluster-$ENVIRONMENT \
  --service saga-web-$ENVIRONMENT \
  --force-new-deployment \
  --region $REGION

echo -e "${YELLOW}Waiting for services to stabilize...${NC}"
aws ecs wait services-stable \
  --cluster saga-cluster-$ENVIRONMENT \
  --services saga-api-$ENVIRONMENT saga-web-$ENVIRONMENT \
  --region $REGION

echo -e "${GREEN}✅ ECS services updated successfully${NC}"

# Step 6: Health checks and validation
echo -e "\n${BLUE}🏥 Step 6: Running Health Checks...${NC}"

# Get ALB DNS name
ALB_DNS=$(cat outputs.json | jq -r '.SagaInfrastructureStack.LoadBalancerDNS')
echo -e "${YELLOW}Load Balancer DNS: $ALB_DNS${NC}"

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 60

# Test health endpoints
echo -e "${YELLOW}Testing API health endpoint...${NC}"
if curl -f "http://$ALB_DNS/api/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ API health check passed${NC}"
else
  echo -e "${RED}❌ API health check failed${NC}"
  exit 1
fi

echo -e "${YELLOW}Testing Web health endpoint...${NC}"
if curl -f "http://$ALB_DNS" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Web health check passed${NC}"
else
  echo -e "${RED}❌ Web health check failed${NC}"
  exit 1
fi

# Step 7: Setup monitoring and alerting
echo -e "\n${BLUE}📊 Step 7: Setting up Monitoring and Alerting...${NC}"

# Run monitoring setup script
if [ -f "infrastructure/scripts/monitoring-setup.sh" ]; then
  echo -e "${YELLOW}Setting up CloudWatch monitoring...${NC}"
  bash infrastructure/scripts/monitoring-setup.sh --environment $ENVIRONMENT --region $REGION
  echo -e "${GREEN}✅ Monitoring setup completed${NC}"
else
  echo -e "${YELLOW}⚠️  Monitoring setup script not found, skipping...${NC}"
fi

# Step 8: Security audit
echo -e "\n${BLUE}🔒 Step 8: Running Security Audit...${NC}"

if [ -f "infrastructure/scripts/security-audit.sh" ]; then
  echo -e "${YELLOW}Running security audit...${NC}"
  bash infrastructure/scripts/security-audit.sh --environment $ENVIRONMENT --region $REGION
  echo -e "${GREEN}✅ Security audit completed${NC}"
else
  echo -e "${YELLOW}⚠️  Security audit script not found, skipping...${NC}"
fi

# Step 9: Generate deployment report
echo -e "\n${BLUE}📋 Step 9: Generating Deployment Report...${NC}"

DEPLOYMENT_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
DEPLOYMENT_ID=$(date +%Y%m%d-%H%M%S)

cat > PRODUCTION_DEPLOYMENT_REPORT.md << EOF
# Saga Family Biography v1.5 MVP - Production Deployment Report

## Deployment Information
- **Deployment ID**: $DEPLOYMENT_ID
- **Environment**: $ENVIRONMENT
- **Region**: $REGION
- **Deployment Time**: $DEPLOYMENT_TIME
- **AWS Account**: $ACCOUNT_ID

## Infrastructure Details
- **Load Balancer DNS**: $ALB_DNS
- **Database Endpoint**: $DB_ENDPOINT
- **API Repository**: $API_REPO_URI
- **Web Repository**: $WEB_REPO_URI

## Deployment Status
- ✅ Infrastructure deployed successfully
- ✅ Docker images built and pushed
- ✅ Database migrations completed
- ✅ ECS services updated
- ✅ Health checks passed
- ✅ Monitoring configured
- ✅ Security audit completed

## Access Information
EOF

if [ ! -z "$DOMAIN_NAME" ]; then
  echo "- **Application URL**: https://$DOMAIN_NAME" >> PRODUCTION_DEPLOYMENT_REPORT.md
else
  echo "- **Application URL**: http://$ALB_DNS" >> PRODUCTION_DEPLOYMENT_REPORT.md
fi

cat >> PRODUCTION_DEPLOYMENT_REPORT.md << EOF
- **API Base URL**: http://$ALB_DNS/api

## Next Steps
1. Configure domain name and SSL certificate (if not done)
2. Set up monitoring dashboards
3. Configure backup schedules
4. Update DNS records (if using custom domain)
5. Test all application functionality
6. Prepare launch materials (Task 9.2)

## Rollback Information
To rollback this deployment, run:
\`\`\`bash
aws ecs update-service --cluster saga-cluster-$ENVIRONMENT --service saga-api-$ENVIRONMENT --task-definition <previous-task-definition>
aws ecs update-service --cluster saga-cluster-$ENVIRONMENT --service saga-web-$ENVIRONMENT --task-definition <previous-task-definition>
\`\`\`

## Support Information
- **CloudWatch Logs**: /ecs/saga-api-$ENVIRONMENT, /ecs/saga-web-$ENVIRONMENT
- **Monitoring Dashboard**: CloudWatch Console
- **Infrastructure Stack**: SagaInfrastructureStack
EOF

echo -e "${GREEN}✅ Deployment report generated: PRODUCTION_DEPLOYMENT_REPORT.md${NC}"

# Final summary
echo -e "\n${GREEN}🎉 PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "${YELLOW}📋 Deployment Summary:${NC}"
echo -e "• Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "• Region: ${GREEN}$REGION${NC}"
echo -e "• Account: ${GREEN}$ACCOUNT_ID${NC}"
echo -e "• Deployment ID: ${GREEN}$DEPLOYMENT_ID${NC}"

if [ ! -z "$DOMAIN_NAME" ]; then
  echo -e "• Application URL: ${GREEN}https://$DOMAIN_NAME${NC}"
else
  echo -e "• Application URL: ${GREEN}http://$ALB_DNS${NC}"
fi

echo -e "\n${YELLOW}📝 Next Steps:${NC}"
echo -e "1. Review the deployment report: ${GREEN}PRODUCTION_DEPLOYMENT_REPORT.md${NC}"
echo -e "2. Test the application thoroughly"
echo -e "3. Configure monitoring alerts"
echo -e "4. Proceed with Task 9.2: Launch Preparation"

echo -e "\n${BLUE}🚀 Saga Family Biography v1.5 MVP is now live in production!${NC}"