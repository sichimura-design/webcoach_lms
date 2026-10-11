#!/usr/bin/env node
/**
 * 本番の監視・利用状況のSlack通知(ログのエラー・アラーム・ECSタスク停止・日次レポート)単体デプロイ用
 * 稼働中のサービス(ECS/ALB/RDS)には何も変更を加えない。ARN/IDは文字列で渡す。
 *
 * 事前に Secrets Manager へ Slack Incoming WebhookのURLを文字列で登録しておくこと。
 *   prod/lms/slack-usage-webhook  利用状況チャンネル
 *   prod/lms/slack-alert-webhook  エラーチャンネル
 * Slackアプリは cdk/lambda/slack-notifier/slack-app-manifest.yml から作れる(Webhookはdevと共用)。
 *
 * ─── デプロイ ────────────────────────────────────────────────────
 *   cd cdk-prod
 *   ./node_modules/.bin/cdk deploy prod-SlackNotifierStack \
 *     --app 'npx ts-node --prefer-ts-exts bin/slack-notifier-app.ts' \
 *     --profile PowerUserAccess-840513866884
 */

import * as cdk from 'aws-cdk-lib';
import { ProdSlackNotifierStack } from '../lib/slack-notifier-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'prod';
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-840513866884 を実行するか、\n' +
    '  CDK_DEFAULT_ACCOUNT=<account_id> を環境変数に設定してください。',
  );
}

const ctx = (key: string, fallback: string) => app.node.tryGetContext(key) ?? fallback;

new ProdSlackNotifierStack(app, `${envName}-SlackNotifierStack`, {
  env: { account: awsAccount, region: awsRegion },
  tags: { Project: 'moodle-spa', Environment: envName, ManagedBy: 'cdk-prod' },
  envName,
  ecsLogGroupName: ctx('ecsLogGroupName', `/ecs/${envName}/lms`),
  ecsClusterName: ctx('ecsClusterName', `${envName}-lms-cluster`),
  ecsServiceName: ctx('ecsServiceName', `${envName}-lms-service`),
  // 2026-10-11時点の実リソース(prod-AlbStack)
  albArn: ctx('albArn',
    'arn:aws:elasticloadbalancing:ap-northeast-1:840513866884:loadbalancer/app/prod-lms-alb/505df0dca2dfd148'),
  targetGroupArn: ctx('targetGroupArn',
    'arn:aws:elasticloadbalancing:ap-northeast-1:840513866884:targetgroup/prod-lms-tg/af622ca03891d1db'),
  dbInstanceIdentifier: ctx('dbInstanceIdentifier', `${envName}-lms-db`),
  dbAllocatedStorageGiB: Number(ctx('dbAllocatedStorageGiB', '20')),
});

app.synth();
