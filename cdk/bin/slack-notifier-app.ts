#!/usr/bin/env node
/**
 * api-server/bff-serverのログのSlack通知(AI利用状況の日次集計+エラー即時通知、dev/uat用)。本番は cdk-prod 側に別途用意する。
 *
 *   cd cdk && npx tsc --build
 *   AWS_PROFILE=PowerUserAccess-822824391912 CDK_DEFAULT_ACCOUNT=822824391912 CDK_DEFAULT_REGION=ap-northeast-1 \
 *     cdk deploy dev-SlackNotifierStack --app "node bin/slack-notifier-app.js" --context env=dev \
 *       --context slackUsageChannel=<利用状況チャンネルID> --context slackAlertChannel=<エラーチャンネルID>
 *
 * Slackへの送り方は2通り。事前に Secrets Manager へ文字列で登録しておくこと。
 *   - botトークン方式(slackUsageChannel / slackAlertChannel を渡したとき)
 *       dev/moodle/slack-bot-token      botトークン(xoxb-...)。chat:write と chat:write.customize が要る
 *   - Incoming Webhook方式(チャンネルIDを渡さないとき)
 *       dev/moodle/slack-usage-webhook  利用状況チャンネル
 *       dev/moodle/slack-alert-webhook  エラーチャンネル
 *       Slackアプリはcdk/lambda/slack-notifier/slack-app-manifest.yml から作れる。
 */
import * as cdk from 'aws-cdk-lib';
import { SlackNotifierStack } from '../lib/slack-notifier-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') || 'dev';
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';

new SlackNotifierStack(app, `${envName}-SlackNotifierStack`, {
  env: process.env.CDK_DEFAULT_ACCOUNT ? { account: process.env.CDK_DEFAULT_ACCOUNT, region } : undefined,
  envName,
  slackUsageChannel: app.node.tryGetContext('slackUsageChannel') || undefined,
  slackAlertChannel: app.node.tryGetContext('slackAlertChannel') || undefined,
  tags: {
    Project: 'moodle-spa',
    Environment: envName,
    ManagedBy: 'cdk',
  },
});

app.synth();
