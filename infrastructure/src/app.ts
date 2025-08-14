#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SagaInfrastructureStack } from './saga-infrastructure-stack';

const app = new cdk.App();

// Get environment configuration
const environment = app.node.tryGetContext('environment') || 'production';
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Create the main infrastructure stack
new SagaInfrastructureStack(app, `SagaInfrastructure-${environment}`, {
  env: {
    account,
    region,
  },
  environment,
  tags: {
    Project: 'Saga Family Biography',
    Environment: environment,
    ManagedBy: 'CDK',
  },
});