#!/bin/bash

# Saga Secrets Management Script
# This script helps manage AWS Secrets Manager secrets for the Saga application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
AWS_REGION=${AWS_REGION:-us-east-1}

# Secret names
DATABASE_SECRET_NAME="saga-database-${ENVIRONMENT}"
APP_SECRET_NAME="saga-app-secrets-${ENVIRONMENT}"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is installed and configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi

    print_success "AWS CLI is properly configured"
}

# Function to create database secret
create_database_secret() {
    print_status "Creating database secret: ${DATABASE_SECRET_NAME}"
    
    # Generate a secure password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Create the secret
    aws secretsmanager create-secret \
        --name "${DATABASE_SECRET_NAME}" \
        --description "Database credentials for Saga ${ENVIRONMENT} environment" \
        --secret-string "{\"username\":\"saga_admin\",\"password\":\"${DB_PASSWORD}\"}" \
        --region "${AWS_REGION}" \
        --tags '[{"Key":"Environment","Value":"'${ENVIRONMENT}'"},{"Key":"Application","Value":"Saga"},{"Key":"Type","Value":"Database"}]' \
        > /dev/null

    print_success "Database secret created successfully"
}

# Function to create application secrets
create_app_secrets() {
    print_status "Creating application secrets: ${APP_SECRET_NAME}"
    
    # Generate secure secrets
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
    
    # Create the secret with placeholder values
    SECRET_VALUE=$(cat <<EOF
{
    "JWT_SECRET": "${JWT_SECRET}",
    "OPENAI_API_KEY": "REPLACE_WITH_ACTUAL_KEY",
    "STRIPE_SECRET_KEY": "REPLACE_WITH_ACTUAL_KEY",
    "STRIPE_WEBHOOK_SECRET": "REPLACE_WITH_ACTUAL_SECRET",
    "SENDGRID_API_KEY": "REPLACE_WITH_ACTUAL_KEY",
    "GOOGLE_CLOUD_SPEECH_KEY": "REPLACE_WITH_ACTUAL_KEY",
    "FIREBASE_PRIVATE_KEY": "REPLACE_WITH_ACTUAL_KEY",
    "FIREBASE_PROJECT_ID": "REPLACE_WITH_ACTUAL_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL": "REPLACE_WITH_ACTUAL_EMAIL",
    "SENTRY_DSN": "REPLACE_WITH_ACTUAL_DSN",
    "ENCRYPTION_KEY": "$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)"
}
EOF
)
    
    aws secretsmanager create-secret \
        --name "${APP_SECRET_NAME}" \
        --description "Application secrets for Saga ${ENVIRONMENT} environment" \
        --secret-string "${SECRET_VALUE}" \
        --region "${AWS_REGION}" \
        --tags '[{"Key":"Environment","Value":"'${ENVIRONMENT}'"},{"Key":"Application","Value":"Saga"},{"Key":"Type","Value":"Application"}]' \
        > /dev/null

    print_success "Application secrets created successfully"
    print_warning "Please update the placeholder values with actual API keys"
}

# Function to update a specific secret value
update_secret_value() {
    local secret_name=$1
    local key=$2
    local value=$3
    
    print_status "Updating ${key} in ${secret_name}"
    
    # Get current secret value
    current_secret=$(aws secretsmanager get-secret-value \
        --secret-id "${secret_name}" \
        --region "${AWS_REGION}" \
        --query SecretString --output text)
    
    # Update the specific key
    updated_secret=$(echo "${current_secret}" | jq --arg key "${key}" --arg value "${value}" '.[$key] = $value')
    
    # Update the secret
    aws secretsmanager update-secret \
        --secret-id "${secret_name}" \
        --secret-string "${updated_secret}" \
        --region "${AWS_REGION}" \
        > /dev/null
    
    print_success "Successfully updated ${key}"
}

# Function to rotate database password
rotate_database_password() {
    print_status "Rotating database password for ${DATABASE_SECRET_NAME}"
    
    # Generate new password
    NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Get current secret
    current_secret=$(aws secretsmanager get-secret-value \
        --secret-id "${DATABASE_SECRET_NAME}" \
        --region "${AWS_REGION}" \
        --query SecretString --output text)
    
    # Update password
    updated_secret=$(echo "${current_secret}" | jq --arg password "${NEW_PASSWORD}" '.password = $password')
    
    # Update the secret
    aws secretsmanager update-secret \
        --secret-id "${DATABASE_SECRET_NAME}" \
        --secret-string "${updated_secret}" \
        --region "${AWS_REGION}" \
        > /dev/null
    
    print_success "Database password rotated successfully"
    print_warning "Remember to update the RDS instance with the new password"
}

# Function to list all secrets
list_secrets() {
    print_status "Listing Saga secrets for ${ENVIRONMENT} environment"
    
    aws secretsmanager list-secrets \
        --region "${AWS_REGION}" \
        --filters Key=tag-key,Values=Application Key=tag-value,Values=Saga \
        --query 'SecretList[?contains(Name, `'${ENVIRONMENT}'`)].{Name:Name,Description:Description,LastChanged:LastChangedDate}' \
        --output table
}

# Function to get secret value (masked)
get_secret() {
    local secret_name=$1
    
    print_status "Getting secret: ${secret_name}"
    
    aws secretsmanager get-secret-value \
        --secret-id "${secret_name}" \
        --region "${AWS_REGION}" \
        --query SecretString --output text | jq -r 'to_entries[] | "\(.key): \(.value | if length > 10 then .[:10] + "..." else . end)"'
}

# Function to delete secrets (with confirmation)
delete_secrets() {
    print_warning "This will delete all secrets for ${ENVIRONMENT} environment"
    read -p "Are you sure? (yes/no): " -r
    
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_status "Deleting secrets..."
        
        aws secretsmanager delete-secret \
            --secret-id "${DATABASE_SECRET_NAME}" \
            --region "${AWS_REGION}" \
            --force-delete-without-recovery \
            > /dev/null 2>&1 || true
        
        aws secretsmanager delete-secret \
            --secret-id "${APP_SECRET_NAME}" \
            --region "${AWS_REGION}" \
            --force-delete-without-recovery \
            > /dev/null 2>&1 || true
        
        print_success "Secrets deleted successfully"
    else
        print_status "Operation cancelled"
    fi
}

# Function to backup secrets
backup_secrets() {
    local backup_dir="./secrets-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${backup_dir}"
    
    print_status "Backing up secrets to ${backup_dir}"
    
    # Backup database secret
    aws secretsmanager get-secret-value \
        --secret-id "${DATABASE_SECRET_NAME}" \
        --region "${AWS_REGION}" \
        --query SecretString --output text > "${backup_dir}/database-secret.json"
    
    # Backup app secrets
    aws secretsmanager get-secret-value \
        --secret-id "${APP_SECRET_NAME}" \
        --region "${AWS_REGION}" \
        --query SecretString --output text > "${backup_dir}/app-secrets.json"
    
    print_success "Secrets backed up to ${backup_dir}"
    print_warning "Keep these backup files secure and delete them after use"
}

# Function to validate secrets
validate_secrets() {
    print_status "Validating secrets for ${ENVIRONMENT} environment"
    
    # Check if secrets exist
    if aws secretsmanager describe-secret --secret-id "${DATABASE_SECRET_NAME}" --region "${AWS_REGION}" &> /dev/null; then
        print_success "Database secret exists"
    else
        print_error "Database secret not found"
    fi
    
    if aws secretsmanager describe-secret --secret-id "${APP_SECRET_NAME}" --region "${AWS_REGION}" &> /dev/null; then
        print_success "Application secrets exist"
        
        # Check for placeholder values
        secret_value=$(aws secretsmanager get-secret-value \
            --secret-id "${APP_SECRET_NAME}" \
            --region "${AWS_REGION}" \
            --query SecretString --output text)
        
        if echo "${secret_value}" | grep -q "REPLACE_WITH_ACTUAL"; then
            print_warning "Some secrets still contain placeholder values"
        else
            print_success "All secrets appear to be properly configured"
        fi
    else
        print_error "Application secrets not found"
    fi
}

# Main function
main() {
    case "${2:-help}" in
        "create")
            check_aws_cli
            create_database_secret
            create_app_secrets
            ;;
        "update")
            check_aws_cli
            if [[ -z "$3" || -z "$4" ]]; then
                print_error "Usage: $0 ${ENVIRONMENT} update <secret_key> <secret_value>"
                exit 1
            fi
            update_secret_value "${APP_SECRET_NAME}" "$3" "$4"
            ;;
        "rotate-db")
            check_aws_cli
            rotate_database_password
            ;;
        "list")
            check_aws_cli
            list_secrets
            ;;
        "get")
            check_aws_cli
            if [[ -z "$3" ]]; then
                print_error "Usage: $0 ${ENVIRONMENT} get <secret_name>"
                exit 1
            fi
            get_secret "$3"
            ;;
        "delete")
            check_aws_cli
            delete_secrets
            ;;
        "backup")
            check_aws_cli
            backup_secrets
            ;;
        "validate")
            check_aws_cli
            validate_secrets
            ;;
        "help"|*)
            echo "Saga Secrets Management Script"
            echo ""
            echo "Usage: $0 <environment> <command> [options]"
            echo ""
            echo "Commands:"
            echo "  create              Create initial secrets"
            echo "  update <key> <val>  Update a specific secret value"
            echo "  rotate-db           Rotate database password"
            echo "  list                List all secrets"
            echo "  get <name>          Get secret value (masked)"
            echo "  delete              Delete all secrets (with confirmation)"
            echo "  backup              Backup secrets to local files"
            echo "  validate            Validate secrets configuration"
            echo "  help                Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 staging create"
            echo "  $0 production update OPENAI_API_KEY sk-..."
            echo "  $0 staging rotate-db"
            echo "  $0 production validate"
            ;;
    esac
}

# Run main function
main "$@"