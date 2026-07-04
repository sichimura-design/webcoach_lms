#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { Ec2AmiStack } from '../lib/ec2-ami-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') || 'dev';
const amiId = app.node.tryGetContext('amiId');
const keyPairName = app.node.tryGetContext('keyPairName');
const awsRegion = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const cognitoUserPoolId = app.node.tryGetContext('cognitoUserPoolId');

if (!amiId) {
  throw new Error('amiId context is required. Use --context amiId=ami-xxxxx');
}

const env = process.env.CDK_DEFAULT_ACCOUNT
  ? { account: process.env.CDK_DEFAULT_ACCOUNT, region: awsRegion }
  : undefined;

const commonProps: cdk.StackProps = {
  env,
  tags: {
    Project: 'moodle-spa',
    Environment: envName,
    ManagedBy: 'cdk',
  },
};

// VPC
const vpcStack = new VpcStack(app, `${envName}-VpcStack`, {
  ...commonProps,
  envName,
});

// EC2 (AMI-based)
const ec2AmiStack = new Ec2AmiStack(app, `${envName}-Ec2AmiStack`, {
  ...commonProps,
  envName,
  vpc: vpcStack.vpc,
  amiId,
  keyPairName,
  cognitoUserPoolId,
});
ec2AmiStack.addDependency(vpcStack);

app.synth();
