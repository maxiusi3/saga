#!/bin/bash

# Saga Test Environment Deployment Script
# This script deploys the Saga application to the test environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="test"
AWS_REGION="us-east-1"
STACK_NAME="saga-test-stack"

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    # Check if CDK is installed
    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK is not installed. Please install it first: npm install -g aws-cdk"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "All prerequisites are met"
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build backend image
    print_status "Building backend image..."
    docker build -f packages/backend/Dockerfile.production -t saga-backend:test .
    
    # Build web image
    print_status "Building web image..."
    docker build -f packages/web/Dockerfile.production -t saga-web:test .
    
    print_success "Docker images built successfully"
}

# Function to run tests
run_tests() {
    print_status "Running tests before deployment..."
    
    # Install dependencies if not already installed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    
    # Run backend tests
    print_status "Running backend tests..."
    cd packages/backend
    npm test -- --passWithNoTests
    cd ../..
    
    # Run web tests
    print_status "Running web tests..."
    cd packages/web
    npm test -- --passWithNoTests --watchAll=false
    cd ../..
    
    # Run shared tests
    print_status "Running shared tests..."
    cd packages/shared
    npm test -- --passWithNoTests
    cd ../..
    
    print_success "All tests passed"
}

# Function to setup secrets
setup_secrets() {
    print_status "Setting up secrets for test environment..."
    
    # Run secrets management script
    ./infrastructure/scripts/manage-secrets.sh test create
    
    print_success "Secrets configured for test environment"
}

# Function to deploy infrastructure
deploy_infrastructure() {
    print_status "Deploying infrastructure to test environment..."
    
    cd infrastructure
    
    # Install CDK dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing CDK dependencies..."
        npm install
    fi
    
    # Bootstrap CDK if needed
    print_status "Bootstrapping CDK..."
    cdk bootstrap --context environment=test
    
    # Deploy the stack
    print_status "Deploying CDK stack..."
    cdk deploy $STACK_NAME --context environment=test --require-approval never
    
    cd ..
    
    print_success "Infrastructure deployed successfully"
}

# Function to push Docker images to ECR
push_images() {
    print_status "Pushing Docker images to ECR..."
    
    # Get ECR repository URIs from CDK outputs
    API_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`APIRepositoryURI`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    WEB_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`WebRepositoryURI`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    if [ -z "$API_REPO_URI" ] || [ -z "$WEB_REPO_URI" ]; then
        print_error "Could not get ECR repository URIs from CloudFormation stack"
        exit 1
    fi
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $API_REPO_URI
    
    # Tag and push backend image
    docker tag saga-backend:test $API_REPO_URI:test
    docker push $API_REPO_URI:test
    
    # Tag and push web image
    docker tag saga-web:test $WEB_REPO_URI:test
    docker push $WEB_REPO_URI:test
    
    print_success "Docker images pushed to ECR"
}

# Function to update ECS services
update_services() {
    print_status "Updating ECS services..."
    
    # Get cluster name from CDK outputs
    CLUSTER_NAME=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    if [ -z "$CLUSTER_NAME" ]; then
        print_error "Could not get ECS cluster name from CloudFormation stack"
        exit 1
    fi
    
    # Force new deployment for API service
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service saga-api-test \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    # Force new deployment for Web service
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service saga-web-test \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    print_success "ECS services updated"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Get database endpoint from CDK outputs
    DB_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    if [ -z "$DB_ENDPOINT" ]; then
        print_error "Could not get database endpoint from CloudFormation stack"
        exit 1
    fi
    
    # Run migrations using the migration script
    ./scripts/migrate-database.sh test
    
    print_success "Database migrations completed"
}

# Function to validate deployment
validate_deployment() {
    print_status "Validating deployment..."
    
    # Get load balancer DNS from CDK outputs
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    if [ -z "$ALB_DNS" ]; then
        print_error "Could not get load balancer DNS from CloudFormation stack"
        exit 1
    fi
    
    # Wait for services to be stable
    print_status "Waiting for services to stabilize..."
    sleep 60
    
    # Test health endpoint
    print_status "Testing health endpoint..."
    for i in {1..10}; do
        if curl -f -s "http://$ALB_DNS/health" > /dev/null; then
            print_success "Health check passed"
            break
        fi
        
        if [ $i -eq 10 ]; then
            print_error "Health check failed after 10 attempts"
            exit 1
        fi
        
        print_status "Health check attempt $i failed, retrying in 30 seconds..."
        sleep 30
    done
    
    # Run deployment validation script
    ./infrastructure/scripts/deployment-validation.sh test
    
    print_success "Deployment validation completed"
}

# Function to run smoke tests
run_smoke_tests() {
    print_status "Running smoke tests..."
    
    # Get load balancer DNS
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    # Set API URL for tests
    export TEST_API_URL="http://$ALB_DNS"
    
    # Run API tests
    ./scripts/test-api.sh
    
    print_success "Smoke tests completed"
}

# Function to send deployment notification
send_notification() {
    print_status "Sending deployment notification..."
    
    # Get deployment info
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    DEPLOYMENT_TIME=$(date)
    
    # Create deployment summary
    cat > /tmp/deployment-summary.txt << EOF
Saga Test Environment Deployment Summary
========================================

Environment: $ENVIRONMENT
Deployment Time: $DEPLOYMENT_TIME
Stack Name: $STACK_NAME
Region: $AWS_REGION

URLs:
- Application: http://$ALB_DNS
- Health Check: http://$ALB_DNS/health
- API Documentation: http://$ALB_DNS/api-docs

Status: ✅ Deployment Successful

Next Steps:
1. Run integration tests
2. Perform manual testing
3. Update test documentation
4. Notify QA team

EOF
    
    print_success "Deployment completed successfully!"
    echo ""
    cat /tmp/deployment-summary.txt
    
    # Clean up
    rm -f /tmp/deployment-summary.txt
}

# Function to cleanup on failure
cleanup_on_failure() {
    print_error "Deployment failed. Cleaning up..."
    
    # Remove any temporary files
    rm -f /tmp/deployment-summary.txt
    
    # Optionally rollback (uncomment if needed)
    # print_status "Rolling back deployment..."
    # ./scripts/rollback-deployment.sh test
    
    exit 1
}

# Main deployment function
main() {
    print_status "Starting Saga test environment deployment..."
    
    # Set up error handling
    trap cleanup_on_failure ERR
    
    # Run deployment steps
    check_prerequisites
    build_images
    run_tests
    setup_secrets
    deploy_infrastructure
    push_images
    update_services
    run_migrations
    validate_deployment
    run_smoke_tests
    send_notification
    
    print_success "Test environment deployment completed successfully! 🚀"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "validate")
        validate_deployment
        ;;
    "test")
        run_smoke_tests
        ;;
    "rollback")
        ./scripts/rollback-deployment.sh test
        ;;
    "help"|*)
        echo "Saga Test Environment Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    Deploy the test environment (default)"
        echo "  validate  Validate existing deployment"
        echo "  test      Run smoke tests"
        echo "  rollback  Rollback deployment"
        echo "  help      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 deploy"
        echo "  $0 validate"
        echo "  $0 test"
        ;;
esac