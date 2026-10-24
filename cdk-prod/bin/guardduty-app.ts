#!/usr/bin/env node
/**
 * GuardDuty(脅威検知)単体デプロイ用(稼働中のECS/ALB/RDSには何も変更を加えない)
 *
 * ─── デプロイ ────────────────────────────────────────────────────
 *   cd cdk-prod
 *   ./node_modules/.bin/cdk deploy prod-GuardDutyStack \
 *     --app 'npx ts-node --prefer-ts-exts bin/guardduty-app.ts' \
 *     --profile PowerUserAccess-840513866884
 *
 *   GuardDutyはリージョンごとに1アカウント1つしか作れない。コンソールやCLIで既に有効にしてあると
 *   このスタックの作成は失敗するので、その場合は既存のディテクターを先に消すかcdk importする。
 */

import * as cdk from 'aws-cdk-lib';
import { ProdGuardDutyStack } from '../lib/guardduty-stack';

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

new ProdGuardDutyStack(app, `${envName}-GuardDutyStack`, {
  env: { account: awsAccount, region: awsRegion },
  tags: { Project: 'moodle-spa', Environment: envName, ManagedBy: 'cdk-prod' },
  envName,
});
