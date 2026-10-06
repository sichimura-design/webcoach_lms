#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') || 'dev';
const moodleDomain = app.node.tryGetContext('moodleDomain') || 'localhost';
const loginUrl = app.node.tryGetContext('loginUrl') || 'http://localhost:5173/login';
const contactUrl = app.node.tryGetContext('contactUrl') || 'https://o4dqp.channel.io/workflows/783132';

const env = process.env.CDK_DEFAULT_ACCOUNT
  ? {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
    }
  : undefined;

new CognitoStack(app, `${envName}-CognitoStack`, {
  env,
  tags: {
    Project: 'moodle-spa',
    Environment: envName,
    ManagedBy: 'cdk',
  },
  envName,
  moodleDomain,
  loginUrl,
  contactUrl,
});

app.synth();
