#!/usr/bin/env node
/**
 * 本番環境 Cognito スタック単独デプロイ
 *
 * デプロイ:
 *   cd cdk-prod
 *   node_modules/.bin/cdk deploy prod-CognitoStack \
 *     --app 'npx ts-node --prefer-ts-exts bin/cognito-app.ts' \
 *     --profile PowerUserAccess-840513866884 \
 *     --require-approval never
 *
 * 既定値は bin/prod-app.ts と揃えてある(片方だけ変えると、どちらからデプロイしたかで
 * 送信元アドレスやコールバックURLが入れ替わる)。
 */

import * as cdk from 'aws-cdk-lib';
import { ProdCognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'prod';
const moodleDomain = app.node.tryGetContext('moodleDomain') ?? 'api.webcoach.jp';
const sesFromEmail = app.node.tryGetContext('sesFromEmail') ?? 'noreply@webcoach.jp';
const sesFromDomain = app.node.tryGetContext('sesFromDomain') ?? 'webcoach.jp';
const loginUrl = app.node.tryGetContext('loginUrl') ?? 'https://study.webcoach.jp/login';
const contactUrl = app.node.tryGetContext('contactUrl') ?? 'https://o4dqp.channel.io/workflows/783132';

const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-840513866884 を設定してください。'
  );
}

new ProdCognitoStack(app, `${envName}-CognitoStack`, {
  env: { account: awsAccount, region: awsRegion },
  tags: { Project: 'moodle-spa', Environment: envName, ManagedBy: 'cdk-prod' },
  envName,
  moodleDomain,
  sesFromEmail,
  sesFromDomain,
  loginUrl,
  contactUrl,
});

app.synth();
