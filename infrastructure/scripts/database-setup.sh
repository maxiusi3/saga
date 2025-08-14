#!/bin/bash

# Database Setup and Migration Script for Saga
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
ACTION=""

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
    -a|--action)
      ACTION="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment    Environment (default: production)"
      echo "  -r, --region         AWS region (default: us-east-1)"
      echo "  -p, --profile        AWS profile to use"
      echo "  -a, --action         Action: migrate, seed, or status"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

if [ -z "$ACTION" ]; then
  echo -e "${RED}❌ Action is required (migrate, seed, or status)${NC}"
  exit 1
fi

echo -e "${GREEN}🗄️  Database management for Saga${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Action: ${YELLOW}$ACTION${NC}"

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
  echo -e "AWS Profile: ${YELLOW}$PROFILE${NC}"
fi

STACK_NAME="SagaInfrastructure-$ENVIRONMENT"

# Get database endpoint
echo -e "${BLUE}🔍 Getting database connection info...${NC}"
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
  --output text \
  --region $REGION)

if [ -z "$DB_ENDPOINT" ]; then
  echo -e "${RED}❌ Could not find database endpoint${NC}"
  exit 1
fi

# Get database credentials from Secrets Manager
DB_SECRET_NAME="saga-database-$ENVIRONMENT"
DB_CREDENTIALS=$(aws secretsmanager get-secret-value \
  --secret-id $DB_SECRET_NAME \
  --region $REGION \
  --query 'SecretString' \
  --output text)

DB_USERNAME=$(echo $DB_CREDENTIALS | jq -r '.username')
DB_PASSWORD=$(echo $DB_CREDENTIALS | jq -r '.password')

echo -e "${GREEN}✅ Database connection info retrieved${NC}"
echo -e "Endpoint: ${YELLOW}$DB_ENDPOINT${NC}"
echo -e "Username: ${YELLOW}$DB_USERNAME${NC}"

# Create connection string
DATABASE_URL="postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_ENDPOINT:5432/saga"

case $ACTION in
  "status")
    echo -e "${BLUE}📊 Checking database status...${NC}"
    
    # Test connection
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USERNAME -d saga -c "SELECT version();" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Database connection successful${NC}"
      
      # Check if migrations table exists
      if PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USERNAME -d saga -c "SELECT * FROM knex_migrations LIMIT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Migrations table exists${NC}"
        
        # Show migration status
        echo -e "${BLUE}📋 Migration status:${NC}"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USERNAME -d saga -c "SELECT name, batch, migration_time FROM knex_migrations ORDER BY migration_time DESC LIMIT 10;"
      else
        echo -e "${YELLOW}⚠️  Migrations table does not exist${NC}"
      fi
    else
      echo -e "${RED}❌ Database connection failed${NC}"
      exit 1
    fi
    ;;
    
  "migrate")
    echo -e "${BLUE}🚀 Running database migrations...${NC}"
    
    # Change to backend directory
    cd packages/backend
    
    # Set environment variables
    export NODE_ENV=$ENVIRONMENT
    export DATABASE_URL=$DATABASE_URL
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
      echo -e "${YELLOW}📦 Installing dependencies...${NC}"
      npm install
    fi
    
    # Run migrations
    echo -e "${GREEN}🔄 Running migrations...${NC}"
    npx knex migrate:latest
    
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
    
    # Go back to root directory
    cd ../..
    ;;
    
  "seed")
    echo -e "${BLUE}🌱 Seeding database...${NC}"
    
    # Change to backend directory
    cd packages/backend
    
    # Set environment variables
    export NODE_ENV=$ENVIRONMENT
    export DATABASE_URL=$DATABASE_URL
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
      echo -e "${YELLOW}📦 Installing dependencies...${NC}"
      npm install
    fi
    
    # Run seeds
    echo -e "${GREEN}🌱 Running seeds...${NC}"
    npx knex seed:run
    
    echo -e "${GREEN}✅ Database seeded successfully${NC}"
    
    # Go back to root directory
    cd ../..
    ;;
    
  *)
    echo -e "${RED}❌ Unknown action: $ACTION${NC}"
    echo "Valid actions: migrate, seed, status"
    exit 1
    ;;
esac

echo -e "${GREEN}🏁 Database management completed!${NC}"