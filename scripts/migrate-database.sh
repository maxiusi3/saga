#!/bin/bash

# Database Migration Script for CI/CD
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
DRY_RUN=false

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
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment    Environment (default: production)"
      echo "  -r, --region         AWS region (default: us-east-1)"
      echo "  --dry-run           Show what would be migrated without executing"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🗄️  Database Migration for Saga${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Dry Run: ${YELLOW}$DRY_RUN${NC}"

STACK_NAME="SagaInfrastructure-$ENVIRONMENT"

# Get database connection info
echo -e "${BLUE}🔍 Getting database connection info...${NC}"

DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

if [ -z "$DB_ENDPOINT" ]; then
  echo -e "${RED}❌ Could not get database endpoint from CloudFormation stack${NC}"
  exit 1
fi

# Get database credentials
DB_SECRET_NAME="saga-database-$ENVIRONMENT"
DB_CREDENTIALS=$(aws secretsmanager get-secret-value \
  --secret-id $DB_SECRET_NAME \
  --region $REGION \
  --query 'SecretString' \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_CREDENTIALS" ]; then
  echo -e "${RED}❌ Could not get database credentials from Secrets Manager${NC}"
  exit 1
fi

DB_USERNAME=$(echo $DB_CREDENTIALS | jq -r '.username')
DB_PASSWORD=$(echo $DB_CREDENTIALS | jq -r '.password')

echo -e "${GREEN}✅ Database connection info retrieved${NC}"
echo -e "Endpoint: ${YELLOW}$DB_ENDPOINT${NC}"
echo -e "Username: ${YELLOW}$DB_USERNAME${NC}"

# Create connection string
DATABASE_URL="postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_ENDPOINT:5432/saga"

# Test database connection
echo -e "${BLUE}🔗 Testing database connection...${NC}"
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USERNAME -d saga -c "SELECT version();" > /dev/null 2>&1; then
  echo -e "${RED}❌ Database connection failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Database connection successful${NC}"

# Change to backend directory
cd packages/backend

# Set environment variables
export NODE_ENV=$ENVIRONMENT
export DATABASE_URL=$DATABASE_URL

# Check current migration status
echo -e "${BLUE}📋 Checking current migration status...${NC}"
CURRENT_MIGRATIONS=$(npx knex migrate:currentVersion 2>/dev/null || echo "none")
echo -e "Current migration version: ${YELLOW}$CURRENT_MIGRATIONS${NC}"

# Get list of pending migrations
echo -e "${BLUE}📝 Checking for pending migrations...${NC}"
PENDING_MIGRATIONS=$(npx knex migrate:list 2>/dev/null | grep "Not run" | wc -l || echo "0")

if [ "$PENDING_MIGRATIONS" -eq 0 ]; then
  echo -e "${GREEN}✅ No pending migrations found${NC}"
  exit 0
fi

echo -e "${YELLOW}⚠️  Found $PENDING_MIGRATIONS pending migrations${NC}"

# Show pending migrations
echo -e "${BLUE}📋 Pending migrations:${NC}"
npx knex migrate:list | grep "Not run" || true

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}🔍 Dry run mode - migrations would be executed but not committed${NC}"
  exit 0
fi

# Create backup before migration (production only)
if [ "$ENVIRONMENT" = "production" ]; then
  echo -e "${BLUE}💾 Creating database backup...${NC}"
  
  BACKUP_NAME="saga-backup-$(date +%Y%m%d-%H%M%S)"
  
  # Create RDS snapshot
  aws rds create-db-snapshot \
    --db-instance-identifier $(aws rds describe-db-instances \
      --query "DBInstances[?contains(DBInstanceIdentifier, 'saga') && contains(DBInstanceIdentifier, '$ENVIRONMENT')].DBInstanceIdentifier" \
      --output text \
      --region $REGION) \
    --db-snapshot-identifier $BACKUP_NAME \
    --region $REGION > /dev/null
  
  echo -e "${GREEN}✅ Database backup created: $BACKUP_NAME${NC}"
fi

# Run migrations
echo -e "${BLUE}🚀 Running database migrations...${NC}"

# Start transaction log
echo "Migration started at $(date)" > migration.log

# Run migrations with error handling
if npx knex migrate:latest 2>&1 | tee -a migration.log; then
  echo -e "${GREEN}✅ Migrations completed successfully${NC}"
  
  # Verify migration status
  NEW_VERSION=$(npx knex migrate:currentVersion 2>/dev/null || echo "unknown")
  echo -e "New migration version: ${YELLOW}$NEW_VERSION${NC}"
  
  # Log success
  echo "Migration completed successfully at $(date)" >> migration.log
  
else
  echo -e "${RED}❌ Migration failed${NC}"
  
  # Log failure
  echo "Migration failed at $(date)" >> migration.log
  
  # If this is production and we have a backup, suggest rollback
  if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}💡 To rollback, you can restore from backup: $BACKUP_NAME${NC}"
  fi
  
  exit 1
fi

# Run post-migration verification
echo -e "${BLUE}🔍 Running post-migration verification...${NC}"

# Check if all tables exist
EXPECTED_TABLES=("users" "projects" "stories" "interactions" "invitations" "subscriptions" "export_requests" "notifications" "notification_preferences" "device_tokens" "prompts" "user_prompts" "chapter_summaries")

for table in "${EXPECTED_TABLES[@]}"; do
  if PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USERNAME -d saga -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Table '$table' exists and is accessible${NC}"
  else
    echo -e "${RED}❌ Table '$table' is not accessible${NC}"
    exit 1
  fi
done

# Check migration history
echo -e "${BLUE}📋 Migration history:${NC}"
npx knex migrate:list | head -10

echo -e "${GREEN}🎉 Database migration completed successfully!${NC}"

# Clean up
rm -f migration.log

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Verify application functionality"
echo "2. Monitor application logs for any issues"
echo "3. Run smoke tests to ensure everything works"

if [ "$ENVIRONMENT" = "production" ]; then
  echo "4. Keep backup $BACKUP_NAME for rollback if needed"
fi