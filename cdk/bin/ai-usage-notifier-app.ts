#!/usr/bin/env node
/**
 * AI利用ログのSlack通知(dev/uat用)。本番は cdk-prod 側に別途用意する。
 *
 *   cd cdk && npx tsc --build
 *   AWS_PROFILE=PowerUserAccess-822824391912 CDK_DEFAULT_ACCOUNT=822824391912 CDK_DEFAULT_REGION=ap-northeast-1 \
 *     cdk deploy dev-AiUsageNotifierStack --app "node bin/ai-usage-notifier-app.js" --context env=dev
 *
 * 事前に Secrets Manager へ `dev/moodle/slack-ai-usage-webhook`(値=Slack Incoming WebhookのURL)を登録しておくこと。
 */
import * as cdk from 'aws-cdk-lib';
import { AiUsageNotifierStack } from '../lib/ai-usage-notifier-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') || 'dev';
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';

new AiUsageNotifierStack(app, `${envName}-AiUsageNotifierStack`, {
  env: process.env.CDK_DEFAULT_ACCOUNT ? { account: process.env.CDK_DEFAULT_ACCOUNT, region } : undefined,
  envName,
  tags: {
    Project: 'moodle-spa',
    Environment: envName,
    ManagedBy: 'cdk',
  },
});

app.synth();
