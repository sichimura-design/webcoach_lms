#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { S3Stack } from '../lib/s3-stack';
import { RdsStack } from '../lib/rds-stack';
import { AuroraStack } from '../lib/aurora-stack';
import { Ec2Stack } from '../lib/ec2-stack';
import { EcsStack } from '../lib/ecs-stack';
import { EcrStack } from '../lib/ecr-stack';
import { CognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();

// Environment configuration
const envName = app.node.tryGetContext('env') || 'dev';
const keyPairName = app.node.tryGetContext('keyPairName');
const moodleDomain = app.node.tryGetContext('moodleDomain') || 'localhost';
const awsRegion = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';

// Common stack props
// Use environment-agnostic stacks when CDK_DEFAULT_ACCOUNT is not set
const env = process.env.CDK_DEFAULT_ACCOUNT
  ? {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: awsRegion,
    }
  : undefined;

const commonProps: cdk.StackProps = {
  env,
  tags: {
    Project: 'moodle-spa',
    Environment: envName,
    ManagedBy: 'cdk',
  },
};

// VPC Stack - Foundation for all resources
const vpcStack = new VpcStack(app, `${envName}-VpcStack`, {
  ...commonProps,
  envName,
});

// S3 Stack - Storage for frontend and Moodle files
const s3Stack = new S3Stack(app, `${envName}-S3Stack`, {
  ...commonProps,
  envName,
});

// Cognito Stack - Authentication for SPA and Moodle OAuth2
const cognitoStack = new CognitoStack(app, `${envName}-CognitoStack`, {
  ...commonProps,
  envName,
  moodleDomain,
});

// RDS Stack - MySQL for Moodle LMS
const rdsStack = new RdsStack(app, `${envName}-RdsStack`, {
  ...commonProps,
  envName,
  vpc: vpcStack.vpc,
});
rdsStack.addDependency(vpcStack);

// Aurora Stack - PostgreSQL with pgvector for AI features
const auroraStack = new AuroraStack(app, `${envName}-AuroraStack`, {
  ...commonProps,
  envName,
  vpc: vpcStack.vpc,
});
auroraStack.addDependency(vpcStack);

// ECR Stack - Container registries for UAT and test environments
if (envName === 'uat' || envName === 'test') {
  new EcrStack(app, `${envName}-EcrStack`, {
    ...commonProps,
    envName,
  });
}

// EC2 Stack - Moodle LMS server (not used in UAT and above; ECS is used instead)
if (envName === 'dev') {
  const ec2Stack = new Ec2Stack(app, `${envName}-Ec2Stack`, {
    ...commonProps,
    envName,
    vpc: vpcStack.vpc,
    moodleStorageBucket: s3Stack.moodleStorageBucket,
    frontendBucketName: 'moodle-spa-frontend-spafrontendbucketa0c499f3-1q1oez2ib24b',
    keyPairName,
    cognitoUserPoolArn: cognitoStack.userPool.userPoolArn,
  });
  ec2Stack.addDependency(vpcStack);
  ec2Stack.addDependency(s3Stack);
  ec2Stack.addDependency(cognitoStack);
}

// ECS Stack - Fargate services (Frontend, BFF, API) - used in UAT and prod
const ecsStack = new EcsStack(app, `${envName}-EcsStack`, {
  ...commonProps,
  envName,
  vpc: vpcStack.vpc,
  rdsSecret: rdsStack.dbSecret,
  auroraSecret: auroraStack.dbSecret,
});
ecsStack.addDependency(vpcStack);
ecsStack.addDependency(rdsStack);
ecsStack.addDependency(auroraStack);

app.synth();
