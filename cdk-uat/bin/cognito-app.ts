#!/usr/bin/env node
/**
 * UAT 環境 Cognito スタック単独デプロイ
 *
 * デプロイ:
 *   cd cdk-uat
 *   node_modules/.bin/cdk deploy uat-CognitoStack \
 *     --app 'npx ts-node --prefer-ts-exts bin/cognito-app.ts' \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 *
 * moodleDomain を指定する場合（ALB確定後）:
 *   --context moodleDomain=<ALB_DNS_NAME>
 */

import * as cdk from 'aws-cdk-lib';
import { UatCognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'uat';
const moodleDomain = app.node.tryGetContext('moodleDomain') ?? 'localhost';

const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-822824391912 を設定してください。'
  );
}

new UatCognitoStack(app, `${envName}-CognitoStack`, {
  env: { account: awsAccount, region: awsRegion },
  tags: { Project: 'moodle-spa', Environment: envName, ManagedBy: 'cdk-uat' },
  envName,
  moodleDomain,
});

app.synth();
