import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

interface SagaInfrastructureStackProps extends cdk.StackProps {
  environment: string;
  domainName?: string;
  hostedZoneId?: string;
}

export class SagaInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SagaInfrastructureStackProps) {
    super(scope, id, props);

    const { environment, domainName, hostedZoneId } = props;

    // VPC Configuration
    const vpc = new ec2.Vpc(this, 'SagaVPC', {
      maxAzs: 3,
      natGateways: environment === 'production' ? 3 : 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // SSL Certificate (if domain is provided)
    let certificate: certificatemanager.Certificate | undefined;
    if (domainName && hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });

      certificate = new certificatemanager.Certificate(this, 'SSLCertificate', {
        domainName,
        subjectAlternativeNames: [`*.${domainName}`],
        validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
      });
    }

    // Web Application Firewall (WAF)
    const webAcl = new wafv2.CfnWebACL(this, 'SagaWebACL', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      description: 'WAF for Saga application',
      name: `saga-waf-${environment}`,
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSetMetric',
          },
        },
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLiRuleSetMetric',
          },
        },
        {
          name: 'RateLimitRule',
          priority: 4,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRuleMetric',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'SagaWebACLMetric',
      },
    });

    // Security Groups
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });

    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic from ALB to API server'
    );

    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3001),
      'Allow traffic from ALB to WebSocket server'
    );

    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for RDS database',
      allowAllOutbound: false,
    });

    databaseSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from ECS'
    );

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Security group for Redis cluster',
      allowAllOutbound: false,
    });

    redisSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis access from ECS'
    );

    // S3 Bucket for media storage
    const mediaBucket = new s3.Bucket(this, 'SagaMediaBucket', {
      bucketName: `saga-media-${environment}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // Will be restricted in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // CloudFront Distribution for media delivery
    const distribution = new cloudfront.Distribution(this, 'SagaMediaDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
    });

    // ECR Repositories
    const apiRepository = new ecr.Repository(this, 'SagaAPIRepository', {
      repositoryName: `saga-api-${environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
      ],
    });

    const webRepository = new ecr.Repository(this, 'SagaWebRepository', {
      repositoryName: `saga-web-${environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
      ],
    });

    // Secrets Manager for sensitive configuration
    const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `saga-database-${environment}`,
      description: 'Database credentials for Saga application',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'saga_admin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });

    const appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: `saga-app-secrets-${environment}`,
      description: 'Application secrets for Saga',
      secretObjectValue: {
        JWT_SECRET: cdk.SecretValue.unsafePlainText('CHANGE_ME_IN_PRODUCTION'),
        OPENAI_API_KEY: cdk.SecretValue.unsafePlainText('CHANGE_ME'),
        STRIPE_SECRET_KEY: cdk.SecretValue.unsafePlainText('CHANGE_ME'),
        SENDGRID_API_KEY: cdk.SecretValue.unsafePlainText('CHANGE_ME'),
        GOOGLE_CLOUD_SPEECH_KEY: cdk.SecretValue.unsafePlainText('CHANGE_ME'),
      },
    });

    // RDS PostgreSQL Database
    const database = new rds.DatabaseInstance(this, 'SagaDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      instanceType: environment === 'production' 
        ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(databaseSecret),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [databaseSecurityGroup],
      multiAz: environment === 'production',
      storageEncrypted: true,
      backupRetention: environment === 'production' ? cdk.Duration.days(7) : cdk.Duration.days(1),
      deletionProtection: environment === 'production',
      databaseName: 'saga',
      allocatedStorage: environment === 'production' ? 100 : 20,
      maxAllocatedStorage: environment === 'production' ? 1000 : 100,
      monitoringInterval: environment === 'production' ? cdk.Duration.seconds(60) : undefined,
      enablePerformanceInsights: environment === 'production',
    });

    // ElastiCache Redis Cluster
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: environment === 'production' ? 'cache.t3.medium' : 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.ref,
      engineVersion: '7.0',
      port: 6379,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'SagaCluster', {
      vpc,
      clusterName: `saga-cluster-${environment}`,
      containerInsights: environment === 'production',
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'SagaALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: `saga-alb-${environment}`,
    });

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      resourceArn: alb.loadBalancerArn,
      webAclArn: webAcl.attrArn,
    });

    // Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant access to secrets
    databaseSecret.grantRead(taskExecutionRole);
    appSecret.grantRead(taskExecutionRole);

    // Task Role for application permissions
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant S3 permissions
    mediaBucket.grantReadWrite(taskRole);

    // CloudWatch Log Groups
    const apiLogGroup = new logs.LogGroup(this, 'APILogGroup', {
      logGroupName: `/ecs/saga-api-${environment}`,
      retention: environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    const webLogGroup = new logs.LogGroup(this, 'WebLogGroup', {
      logGroupName: `/ecs/saga-web-${environment}`,
      retention: environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    // ECS Task Definitions
    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, 'APITaskDefinition', {
      memoryLimitMiB: environment === 'production' ? 2048 : 512,
      cpu: environment === 'production' ? 1024 : 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    const webTaskDefinition = new ecs.FargateTaskDefinition(this, 'WebTaskDefinition', {
      memoryLimitMiB: environment === 'production' ? 1024 : 512,
      cpu: environment === 'production' ? 512 : 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    // Container Definitions
    const apiContainer = apiTaskDefinition.addContainer('api', {
      image: ecs.ContainerImage.fromEcrRepository(apiRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      environment: {
        NODE_ENV: environment,
        PORT: '3000',
        DATABASE_URL: `postgresql://saga_admin:${databaseSecret.secretValueFromJson('password').unsafeUnwrap()}@${database.instanceEndpoint.hostname}:5432/saga`,
        REDIS_URL: `redis://${redisCluster.attrRedisEndpointAddress}:6379`,
        S3_BUCKET: mediaBucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
      },
      secrets: {
        JWT_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'JWT_SECRET'),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(appSecret, 'OPENAI_API_KEY'),
        STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(appSecret, 'STRIPE_SECRET_KEY'),
        SENDGRID_API_KEY: ecs.Secret.fromSecretsManager(appSecret, 'SENDGRID_API_KEY'),
        GOOGLE_CLOUD_SPEECH_KEY: ecs.Secret.fromSecretsManager(appSecret, 'GOOGLE_CLOUD_SPEECH_KEY'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    });

    apiContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    const webContainer = webTaskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(webRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'web',
        logGroup: webLogGroup,
      }),
      environment: {
        NODE_ENV: environment,
        PORT: '3000',
        NEXT_PUBLIC_API_URL: `http://${alb.loadBalancerDnsName}`,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    });

    webContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // ECS Services
    const apiService = new ecs.FargateService(this, 'APIService', {
      cluster,
      taskDefinition: apiTaskDefinition,
      desiredCount: environment === 'production' ? 2 : 1,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      enableExecuteCommand: true,
      serviceName: `saga-api-${environment}`,
    });

    const webService = new ecs.FargateService(this, 'WebService', {
      cluster,
      taskDefinition: webTaskDefinition,
      desiredCount: environment === 'production' ? 2 : 1,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      enableExecuteCommand: true,
      serviceName: `saga-web-${environment}`,
    });

    // Target Groups
    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'APITargetGroup', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    const webTargetGroup = new elbv2.ApplicationTargetGroup(this, 'WebTargetGroup', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // Register services with target groups
    apiService.attachToApplicationTargetGroup(apiTargetGroup);
    webService.attachToApplicationTargetGroup(webTargetGroup);

    // ALB Listeners
    const httpListener = alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // HTTPS Listener (if certificate is available)
    let httpsListener: elbv2.ApplicationListener;
    if (certificate) {
      httpsListener = alb.addListener('HTTPSListener', {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [certificate],
        sslPolicy: elbv2.SslPolicy.TLS12_EXT,
        defaultAction: elbv2.ListenerAction.fixedResponse(404, {
          contentType: 'text/plain',
          messageBody: 'Not Found',
        }),
      });

      // Add security headers
      httpsListener.addTargetGroups('APITargetGroup', {
        targetGroups: [apiTargetGroup],
        conditions: [
          elbv2.ListenerCondition.pathPatterns(['/api/*']),
        ],
        priority: 100,
      });

      httpsListener.addTargetGroups('WebTargetGroup', {
        targetGroups: [webTargetGroup],
        priority: 200,
      });
    } else {
      // Fallback to HTTP for development
      httpListener.addTargetGroups('APITargetGroup', {
        targetGroups: [apiTargetGroup],
        conditions: [
          elbv2.ListenerCondition.pathPatterns(['/api/*']),
        ],
        priority: 100,
      });

      httpListener.addTargetGroups('WebTargetGroup', {
        targetGroups: [webTargetGroup],
        priority: 200,
      });
    }

    // Auto Scaling for production
    if (environment === 'production') {
      const apiScaling = apiService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });

      apiScaling.scaleOnCpuUtilization('APIScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      const webScaling = webService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });

      webScaling.scaleOnCpuUtilization('WebScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: redisCluster.attrRedisEndpointAddress,
      description: 'Redis cluster endpoint',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: mediaBucket.bucketName,
      description: 'S3 bucket for media storage',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    });

    new cdk.CfnOutput(this, 'APIRepositoryURI', {
      value: apiRepository.repositoryUri,
      description: 'ECR repository URI for API',
    });

    new cdk.CfnOutput(this, 'WebRepositoryURI', {
      value: webRepository.repositoryUri,
      description: 'ECR repository URI for Web',
    });
  }
}