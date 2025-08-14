#!/bin/bash

# SSL Certificate Setup Script for Saga
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
DOMAIN=""
REGION="us-east-1"
PROFILE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -d|--domain)
      DOMAIN="$2"
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
      echo "  -d, --domain         Domain name (required)"
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

if [ -z "$DOMAIN" ]; then
  echo -e "${RED}❌ Domain name is required${NC}"
  exit 1
fi

echo -e "${GREEN}🔒 Setting up SSL certificate for Saga${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Domain: ${YELLOW}$DOMAIN${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
  echo -e "AWS Profile: ${YELLOW}$PROFILE${NC}"
fi

# Check if domain exists in Route53
echo -e "${GREEN}🔍 Checking if hosted zone exists for $DOMAIN...${NC}"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name $DOMAIN \
  --query 'HostedZones[0].Id' \
  --output text 2>/dev/null || echo "None")

if [ "$HOSTED_ZONE_ID" = "None" ] || [ -z "$HOSTED_ZONE_ID" ]; then
  echo -e "${YELLOW}⚠️  No hosted zone found for $DOMAIN${NC}"
  echo -e "${YELLOW}📝 Please create a hosted zone in Route53 first:${NC}"
  echo "1. Go to Route53 in AWS Console"
  echo "2. Create a hosted zone for $DOMAIN"
  echo "3. Update your domain's nameservers to point to Route53"
  echo "4. Run this script again"
  exit 1
fi

echo -e "${GREEN}✅ Found hosted zone: $HOSTED_ZONE_ID${NC}"

# Request SSL certificate
echo -e "${GREEN}📜 Requesting SSL certificate...${NC}"
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --subject-alternative-names "www.$DOMAIN" "api.$DOMAIN" \
  --validation-method DNS \
  --region $REGION \
  --query 'CertificateArn' \
  --output text)

echo -e "${GREEN}✅ Certificate requested: $CERT_ARN${NC}"

# Wait for certificate validation records
echo -e "${YELLOW}⏳ Waiting for validation records...${NC}"
sleep 10

# Get validation records
VALIDATION_RECORDS=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $REGION \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord' \
  --output json)

echo -e "${GREEN}📋 Creating DNS validation records...${NC}"

# Create validation records in Route53
echo "$VALIDATION_RECORDS" | jq -r '.[] | @base64' | while read record; do
  DECODED=$(echo $record | base64 --decode)
  NAME=$(echo $DECODED | jq -r '.Name')
  VALUE=$(echo $DECODED | jq -r '.Value')
  TYPE=$(echo $DECODED | jq -r '.Type')
  
  echo -e "${GREEN}Creating record: $NAME${NC}"
  
  aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"CREATE\",
        \"ResourceRecordSet\": {
          \"Name\": \"$NAME\",
          \"Type\": \"$TYPE\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"$VALUE\"}]
        }
      }]
    }" > /dev/null
done

echo -e "${GREEN}✅ DNS validation records created${NC}"

# Wait for certificate validation
echo -e "${YELLOW}⏳ Waiting for certificate validation (this may take several minutes)...${NC}"
aws acm wait certificate-validated \
  --certificate-arn $CERT_ARN \
  --region $REGION

echo -e "${GREEN}✅ Certificate validated successfully!${NC}"

# Get load balancer DNS name
STACK_NAME="SagaInfrastructure-$ENVIRONMENT"
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region $REGION)

if [ -z "$ALB_DNS" ]; then
  echo -e "${RED}❌ Could not find load balancer DNS name${NC}"
  exit 1
fi

# Create DNS records pointing to load balancer
echo -e "${GREEN}🔗 Creating DNS records...${NC}"

# Create A record for root domain
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"$DOMAIN\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$ALB_DNS\"}]
      }
    }]
  }" > /dev/null

# Create A record for www subdomain
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"www.$DOMAIN\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$ALB_DNS\"}]
      }
    }]
  }" > /dev/null

# Create A record for API subdomain
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"api.$DOMAIN\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$ALB_DNS\"}]
      }
    }]
  }" > /dev/null

echo -e "${GREEN}✅ DNS records created${NC}"

echo -e "${GREEN}🎉 SSL setup completed successfully!${NC}"
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "Certificate ARN: ${YELLOW}$CERT_ARN${NC}"
echo -e "Domain: ${YELLOW}https://$DOMAIN${NC}"
echo -e "WWW: ${YELLOW}https://www.$DOMAIN${NC}"
echo -e "API: ${YELLOW}https://api.$DOMAIN${NC}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Update your load balancer to use the SSL certificate"
echo "2. Configure HTTPS listeners in your infrastructure"
echo "3. Update application configuration to use HTTPS URLs"
echo "4. Test the SSL certificate installation"

echo -e "${YELLOW}💡 To update the load balancer with SSL:${NC}"
echo "Update your CDK stack to include the certificate ARN and redeploy"