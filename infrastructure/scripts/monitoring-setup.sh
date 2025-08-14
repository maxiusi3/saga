#!/bin/bash

# Monitoring and Alerting Setup Script for Saga
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
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment    Environment (default: production)"
      echo "  -r, --region         AWS region (default: us-east-1)"
      echo "  -p, --profile        AWS profile to use"
      echo "  --email             Email for alerts (required)"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

if [ -z "$EMAIL" ]; then
  echo -e "${RED}❌ Email address is required for alerts${NC}"
  exit 1
fi

echo -e "${GREEN}📊 Setting up monitoring and alerting for Saga${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Alert Email: ${YELLOW}$EMAIL${NC}"

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
  echo -e "AWS Profile: ${YELLOW}$PROFILE${NC}"
fi

STACK_NAME="SagaInfrastructure-$ENVIRONMENT"

# Create SNS topic for alerts
echo -e "${BLUE}📢 Creating SNS topic for alerts...${NC}"
SNS_TOPIC_ARN=$(aws sns create-topic \
  --name "saga-alerts-$ENVIRONMENT" \
  --region $REGION \
  --query 'TopicArn' \
  --output text)

echo -e "${GREEN}✅ SNS topic created: $SNS_TOPIC_ARN${NC}"

# Subscribe email to SNS topic
echo -e "${BLUE}📧 Subscribing email to alerts...${NC}"
aws sns subscribe \
  --topic-arn $SNS_TOPIC_ARN \
  --protocol email \
  --notification-endpoint $EMAIL \
  --region $REGION > /dev/null

echo -e "${GREEN}✅ Email subscription created${NC}"
echo -e "${YELLOW}📝 Please check your email and confirm the subscription${NC}"

# Create CloudWatch alarms
echo -e "${BLUE}⚠️  Creating CloudWatch alarms...${NC}"

# ECS Service CPU Utilization
aws cloudwatch put-metric-alarm \
  --alarm-name "saga-api-high-cpu-$ENVIRONMENT" \
  --alarm-description "API service high CPU utilization" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_TOPIC_ARN \
  --dimensions Name=ServiceName,Value=saga-api-$ENVIRONMENT Name=ClusterName,Value=saga-cluster-$ENVIRONMENT \
  --region $REGION

# ECS Service Memory Utilization
aws cloudwatch put-metric-alarm \
  --alarm-name "saga-api-high-memory-$ENVIRONMENT" \
  --alarm-description "API service high memory utilization" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_TOPIC_ARN \
  --dimensions Name=ServiceName,Value=saga-api-$ENVIRONMENT Name=ClusterName,Value=saga-cluster-$ENVIRONMENT \
  --region $REGION

# Application Load Balancer Response Time
aws cloudwatch put-metric-alarm \
  --alarm-name "saga-alb-high-response-time-$ENVIRONMENT" \
  --alarm-description "High response time from load balancer" \
  --metric-name TargetResponseTime \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 300 \
  --threshold 2 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

# RDS CPU Utilization
aws cloudwatch put-metric-alarm \
  --alarm-name "saga-rds-high-cpu-$ENVIRONMENT" \
  --alarm-description "RDS high CPU utilization" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

# RDS Database Connections
aws cloudwatch put-metric-alarm \
  --alarm-name "saga-rds-high-connections-$ENVIRONMENT" \
  --alarm-description "RDS high database connections" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

# Application Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name "saga-high-error-rate-$ENVIRONMENT" \
  --alarm-description "High application error rate" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

echo -e "${GREEN}✅ CloudWatch alarms created${NC}"

# Create CloudWatch Dashboard
echo -e "${BLUE}📊 Creating CloudWatch dashboard...${NC}"

DASHBOARD_BODY=$(cat << EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/ECS", "CPUUtilization", "ServiceName", "saga-api-$ENVIRONMENT", "ClusterName", "saga-cluster-$ENVIRONMENT" ],
          [ ".", "MemoryUtilization", ".", ".", ".", "." ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$REGION",
        "title": "ECS Service Metrics",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/ApplicationELB", "TargetResponseTime", { "stat": "Average" } ],
          [ ".", "RequestCount", { "stat": "Sum" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$REGION",
        "title": "Load Balancer Metrics",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/RDS", "CPUUtilization", { "stat": "Average" } ],
          [ ".", "DatabaseConnections", { "stat": "Average" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$REGION",
        "title": "RDS Metrics",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", { "stat": "Sum" } ],
          [ ".", "HTTPCode_Target_4XX_Count", { "stat": "Sum" } ],
          [ ".", "HTTPCode_Target_5XX_Count", { "stat": "Sum" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$REGION",
        "title": "HTTP Response Codes",
        "period": 300
      }
    }
  ]
}
EOF
)

aws cloudwatch put-dashboard \
  --dashboard-name "Saga-$ENVIRONMENT" \
  --dashboard-body "$DASHBOARD_BODY" \
  --region $REGION > /dev/null

echo -e "${GREEN}✅ CloudWatch dashboard created${NC}"

# Create log groups if they don't exist
echo -e "${BLUE}📝 Setting up log groups...${NC}"

aws logs create-log-group \
  --log-group-name "/ecs/saga-api-$ENVIRONMENT" \
  --region $REGION 2>/dev/null || true

aws logs create-log-group \
  --log-group-name "/ecs/saga-web-$ENVIRONMENT" \
  --region $REGION 2>/dev/null || true

# Set log retention
aws logs put-retention-policy \
  --log-group-name "/ecs/saga-api-$ENVIRONMENT" \
  --retention-in-days 30 \
  --region $REGION

aws logs put-retention-policy \
  --log-group-name "/ecs/saga-web-$ENVIRONMENT" \
  --retention-in-days 30 \
  --region $REGION

echo -e "${GREEN}✅ Log groups configured${NC}"

echo -e "${GREEN}🎉 Monitoring setup completed successfully!${NC}"
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "SNS Topic: ${YELLOW}$SNS_TOPIC_ARN${NC}"
echo -e "Dashboard: ${YELLOW}https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=Saga-$ENVIRONMENT${NC}"
echo -e "Alarms: ${YELLOW}https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#alarmsV2:${NC}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Confirm your email subscription for alerts"
echo "2. Review and customize alarm thresholds as needed"
echo "3. Set up additional custom metrics in your application"
echo "4. Configure log aggregation and analysis tools"