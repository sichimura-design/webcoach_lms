#!/usr/bin/env node
/**
 * 本番環境 Cognito スタック単独デプロイ
 *
 * デプロイ:
 *   cd cdk-prod
 *   node_modules/.bin/cdk deploy prod-CognitoStack \
 *     --app 'npx ts-node --prefer-ts-exts bin/cognito-app.ts' \
 *     --context moodleDomain=webcoach.jp \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 */

import * as cdk from 'aws-cdk-lib';
import { ProdCognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'prod';
const moodleDomain = app.node.tryGetContext('moodleDomain') ?? 'webcoach.jp';

const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-822824391912 を設定してください。'
  );
}

new ProdCognitoStack(app, `${envName}-CognitoStack`, {
  env: { account: awsAccount, region: awsRegion },
  tags: { Project: 'moodle-spa', Environment: envName, ManagedBy: 'cdk-prod' },
  envName,
  moodleDomain,
});

app.synth();
