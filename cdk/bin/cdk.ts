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
import { RdsSchedulerStack } from '../lib/rds-scheduler-stack';
import { Ec2MaintenanceStack } from '../lib/ec2-maintenance-stack';
import { EcsSchedulerStack } from '../lib/ecs-scheduler-stack';

const app = new cdk.App();

// Environment configuration
const envName = app.node.tryGetContext('env') || 'dev';
const keyPairName = app.node.tryGetContext('keyPairName');
const moodleDomain = app.node.tryGetContext('moodleDomain') || 'localhost';
const awsRegion = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const loginUrl = app.node.tryGetContext('loginUrl') || 'http://localhost:5173/login';
const contactUrl = app.node.tryGetContext('contactUrl') || 'https://o4dqp.channel.io/workflows/783132';

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
  loginUrl,
  contactUrl,
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
    recordingsBucket: s3Stack.recordingsBucket,
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
  recordingsBucket: s3Stack.recordingsBucket,
});
ecsStack.addDependency(vpcStack);
ecsStack.addDependency(rdsStack);
ecsStack.addDependency(auroraStack);

// Cost-optimization schedulers + RDS maintenance EC2 — prod only.
// These target the *cdk-prod*-deployed RDS instance / ECS cluster (see cdk-prod/),
// not the dev/uat stacks above. They take plain string identifiers via context
// instead of construct references so they can be deployed independently of
// whichever stack actually owns those resources.
if (envName === 'prod') {
  const rdsInstanceIdentifier = app.node.tryGetContext('rdsInstanceIdentifier');
  const vpcId = app.node.tryGetContext('vpcId');
  if (!rdsInstanceIdentifier) {
    throw new Error(
      'Context "rdsInstanceIdentifier" is required for prod (e.g. --context rdsInstanceIdentifier=prod-moodle-db)'
    );
  }
  if (!vpcId) {
    throw new Error('Context "vpcId" is required for prod (e.g. --context vpcId=vpc-xxxxxxxx)');
  }

  new RdsSchedulerStack(app, `${envName}-RdsSchedulerStack`, {
    ...commonProps,
    envName,
    dbInstanceIdentifier: rdsInstanceIdentifier,
  });

  new Ec2MaintenanceStack(app, `${envName}-Ec2MaintenanceStack`, {
    ...commonProps,
    envName,
    vpcId,
  });

  // Defaults match the naming convention fixed in cdk-prod/lib/ecs-stack.ts —
  // override via context only if that ever changes.
  const ecsClusterName = app.node.tryGetContext('ecsClusterName') ?? `${envName}-lms-cluster`;
  const ecsServiceName = app.node.tryGetContext('ecsServiceName') ?? `${envName}-lms-service`;
  const ecsAsgStackName = app.node.tryGetContext('ecsAsgStackName') ?? `${envName}-EcsStack`;

  new EcsSchedulerStack(app, `${envName}-EcsSchedulerStack`, {
    ...commonProps,
    envName,
    clusterName: ecsClusterName,
    serviceName: ecsServiceName,
    asgStackName: ecsAsgStackName,
  });
}

app.synth();
