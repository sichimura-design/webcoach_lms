#!/usr/bin/env node
/**
 * UAT RDS 単体デプロイ用 CDK エントリポイント
 *
 * dev-moodle-vpc (vpc-078369fe5efc5e688) を使い回して RDS だけ立ち上げる。
 * VPC Quota の上限に達しているため新規 VPC は作成しない。
 *
 * ─── デプロイ ────────────────────────────────────────────────────
 *   cd cdk-uat
 *   ./node_modules/.bin/cdk deploy --all \
 *     --app 'npx ts-node --prefer-ts-exts test/rds-app.ts' \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 *
 * ─── diff 確認 ───────────────────────────────────────────────────
 *   ./node_modules/.bin/cdk diff --all \
 *     --app 'npx ts-node --prefer-ts-exts test/rds-app.ts' \
 *     --profile PowerUserAccess-822824391912
 *
 * ─── 削除 ────────────────────────────────────────────────────────
 *   ./node_modules/.bin/cdk destroy --all \
 *     --app 'npx ts-node --prefer-ts-exts test/rds-app.ts' \
 *     --profile PowerUserAccess-822824391912
 */

import * as cdk from 'aws-cdk-lib';
import { UatRdsStack } from './rds-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'uat';
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-822824391912 を実行するか、\n' +
    '  CDK_DEFAULT_ACCOUNT=<account_id> を環境変数に設定してください。',
  );
}

const env: cdk.Environment = { account: awsAccount, region: awsRegion };

const tags = {
  Project: 'moodle-spa',
  Environment: envName,
  ManagedBy: 'cdk-uat',
};

// RDS（dev-moodle-vpc を使い回す。VPC は RdsStack 内で fromLookup する）
new UatRdsStack(app, `${envName}-RdsStack`, {
  env, tags, envName,
  vpcId: 'vpc-078369fe5efc5e688',
});

app.synth();
