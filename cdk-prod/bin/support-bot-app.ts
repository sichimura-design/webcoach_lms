#!/usr/bin/env node
/**
 * 問い合わせ一次対応のSlackボット単体デプロイ用(稼働中のECS/ALB/RDSには何も変更を加えない)
 *
 * 事前準備
 *   1. Slackアプリを cdk-prod/lambda/support-bot/slack-app-manifest.yml から作り、ワークスペースに入れる
 *   2. botトークンと署名シークレットを Secrets Manager に JSON で登録する
 *        aws secretsmanager create-secret --name prod/lms/support-bot-slack \
 *          --secret-string '{"bot_token":"xoxb-...","signing_secret":"..."}' \
 *          --profile PowerUserAccess-840513866884
 *   AnthropicのAPIキーは prod-BackendStack の prod/lms/anthropic-api-key を共用する
 *
 * ─── デプロイ ────────────────────────────────────────────────────
 *   ボットは本番のソース(既定 origin/master)も同梱して読むので、先に最新を取ってくる
 *   git fetch origin master
 *   cd cdk-prod
 *   ./node_modules/.bin/cdk deploy prod-SupportBotStack \
 *     --app 'npx ts-node --prefer-ts-exts bin/support-bot-app.ts' \
 *     [-c supportBotChannels=<答えてよいチャンネルID,...>] \
 *     --profile PowerUserAccess-840513866884
 *   出力 SlackRequestUrl を Slackアプリの Event Subscriptions → Request URL に設定する
 *
 *   docs/support/ のマニュアルを直したとき・本番を更新したときは、同じコマンドで再デプロイすると反映される
 *   (読ませるソースを変えるときは -c supportBotCodeRef=<ブランチやコミット>)
 */

import * as cdk from 'aws-cdk-lib';
import { ProdSupportBotStack } from '../lib/support-bot-stack';

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

new ProdSupportBotStack(app, `${envName}-SupportBotStack`, {
  env: { account: awsAccount, region: awsRegion },
  tags: { Project: 'moodle-spa', Environment: envName, ManagedBy: 'cdk-prod' },
  envName,
  slackSecretName: ctx('supportBotSlackSecret', `${envName}/lms/support-bot-slack`),
  anthropicSecretName: ctx('anthropicSecretName', `${envName}/lms/anthropic-api-key`),
  allowedChannels: ctx('supportBotChannels', ''),
  // 本番で動いているソース。デプロイ前に git fetch origin master しておく
  codeRef: ctx('supportBotCodeRef', 'origin/master'),
});

app.synth();
