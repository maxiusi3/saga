# Saga Infrastructure

This directory contains the AWS infrastructure configuration for the Saga Family Biography Platform using AWS CDK (Cloud Development Kit).

## Architecture Overview

The infrastructure includes:

- **VPC**: Multi-AZ Virtual Private Cloud with public, private, and database subnets
- **ECS Fargate**: Containerized application hosting with auto-scaling
- **RDS PostgreSQL**: Multi-AZ database with automated backups
- **ElastiCache Redis**: In-memory caching and session storage
- **Application Load Balancer**: Traffic distribution with health checks
- **S3 + CloudFront**: Media storage and CDN delivery
- **ECR**: Container image repositories
- **Secrets Manager**: Secure credential storage
- **CloudWatch**: Logging and monitoring

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js** 18+ and npm
3. **Docker** for building container images
4. **AWS CDK** CLI: `npm install -g aws-cdk`
5. **PostgreSQL client** (for database management)

## Quick Start

### 1. Install Dependencies

```bash
cd infrastructure
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap
```

### 3. Deploy Infrastructure

```bash
# Deploy to production
./scripts/deploy.sh -e production

# Deploy to staging
./scripts/deploy.sh -e staging
```

### 4. Build and Deploy Applications

```bash
# From project root
./scripts/build-and-deploy.sh -e production
```

## Environment Configuration

### Production
- Multi-AZ deployment for high availability
- Auto-scaling enabled (2-10 instances)
- Enhanced monitoring and logging
- Deletion protection enabled

### Staging
- Single-AZ deployment for cost optimization
- Limited auto-scaling (1-3 instances)
- Basic monitoring
- No deletion protection

## Scripts

### Infrastructure Management

#### `scripts/deploy.sh`
Deploy the AWS infrastructure using CDK.

```bash
./scripts/deploy.sh [OPTIONS]
Options:
  -e, --environment    Environment to deploy (default: production)
  -r, --region         AWS region (default: us-east-1)
  -p, --profile        AWS profile to use
  -h, --help          Show help message
```

#### `scripts/setup-ssl.sh`
Set up SSL certificate and domain configuration.

```bash
./scripts/setup-ssl.sh -d yourdomain.com -e production
```

#### `scripts/manage-secrets.sh`
Manage application secrets in AWS Secrets Manager.

```bash
# View current secrets
./scripts/manage-secrets.sh -a view -e production

# Update secrets
./scripts/manage-secrets.sh -a update -e production

# Rotate JWT secret
./scripts/manage-secrets.sh -a rotate -e production
```

#### `scripts/database-setup.sh`
Manage database migrations and seeding.

```bash
# Check database status
./scripts/database-setup.sh -a status -e production

# Run migrations
./scripts/database-setup.sh -a migrate -e production

# Seed database
./scripts/database-setup.sh -a seed -e production
```

### Application Deployment

#### `../scripts/build-and-deploy.sh`
Complete application build and deployment.

```bash
# Full deployment
./scripts/build-and-deploy.sh -e production

# Skip infrastructure deployment
./scripts/build-and-deploy.sh -e production --skip-infrastructure

# Skip Docker build
./scripts/build-and-deploy.sh -e production --skip-build
```

## Configuration Files

### Environment Configurations
- `environments/production.json`: Production environment settings
- `environments/staging.json`: Staging environment settings

### CDK Configuration
- `cdk.json`: CDK application configuration
- `tsconfig.json`: TypeScript configuration
- `package.json`: Dependencies and scripts

## Security

### Network Security
- VPC with private subnets for application and database tiers
- Security groups with minimal required access
- NAT gateways for outbound internet access from private subnets

### Data Security
- Encryption at rest for all data stores (RDS, S3, EBS)
- Encryption in transit using TLS 1.3
- Secrets stored in AWS Secrets Manager
- IAM roles with least privilege access

### Application Security
- Container images scanned for vulnerabilities
- Non-root user in containers
- Health checks and monitoring
- Automated security updates

## Monitoring and Logging

### CloudWatch Integration
- Application logs aggregated in CloudWatch Logs
- Custom metrics for application performance
- Alarms for critical system events

### Health Checks
- Load balancer health checks
- Container health checks
- Database connection monitoring

## Backup and Recovery

### Database Backups
- Automated daily backups with point-in-time recovery
- Cross-region backup replication (production)
- 7-day retention for production, 1-day for staging

### Disaster Recovery
- Multi-AZ deployment for database high availability
- Auto-scaling groups for application resilience
- Infrastructure as code for rapid recovery

## Cost Optimization

### Resource Sizing
- Right-sized instances based on environment
- Auto-scaling to handle traffic variations
- Spot instances for non-critical workloads (staging)

### Storage Optimization
- S3 lifecycle policies for media files
- CloudFront caching to reduce origin requests
- EBS volume optimization

## Troubleshooting

### Common Issues

#### Deployment Failures
1. Check AWS credentials and permissions
2. Verify CDK bootstrap is completed
3. Check CloudFormation events in AWS Console

#### Application Not Starting
1. Check ECS service logs in CloudWatch
2. Verify environment variables and secrets
3. Check security group configurations

#### Database Connection Issues
1. Verify security group rules
2. Check database endpoint and credentials
3. Ensure VPC connectivity

### Useful Commands

```bash
# View CDK diff before deployment
npx cdk diff

# View CloudFormation template
npx cdk synth

# Check ECS service status
aws ecs describe-services --cluster saga-cluster-production --services saga-api-production

# View application logs
aws logs tail /ecs/saga-api-production --follow

# Check database status
aws rds describe-db-instances --db-instance-identifier saga-database-production
```

## Maintenance

### Regular Tasks
1. **Security Updates**: Keep base images and dependencies updated
2. **Backup Verification**: Regularly test backup restoration
3. **Performance Monitoring**: Review metrics and optimize as needed
4. **Cost Review**: Monitor AWS costs and optimize resources

### Scaling Considerations
- Monitor CPU and memory utilization
- Adjust auto-scaling policies based on traffic patterns
- Consider database read replicas for high read workloads
- Implement caching strategies for frequently accessed data

## Support

For infrastructure issues:
1. Check CloudWatch logs and metrics
2. Review CloudFormation stack events
3. Consult AWS documentation
4. Contact AWS support for critical issues

## Next Steps

After successful deployment:

1. **Configure Domain**: Set up custom domain and SSL certificate
2. **Update Secrets**: Replace default secrets with production values
3. **Run Migrations**: Initialize database schema
4. **Configure Monitoring**: Set up alerts and dashboards
5. **Performance Testing**: Validate system performance under load
6. **Security Audit**: Conduct security review and penetration testing