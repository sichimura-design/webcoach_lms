#!/usr/bin/env node
/**
 * Prod RDS 単体デプロイ用 CDK エントリポイント
 *
 * prod-VpcStack が作成した VPC (vpc-06ae1bdbdaa5e3c5d) の DatabaseSubnet
 * (PRIVATE_ISOLATED) を使い回して RDS だけ立ち上げる。
 * ECS/EFS/Cognito 等を含む ProdBackendStack とは独立したスタック。
 *
 * ─── デプロイ ────────────────────────────────────────────────────
 *   cd cdk-prod
 *   ./node_modules/.bin/cdk deploy --all \
 *     --app 'npx ts-node --prefer-ts-exts bin/rds-app.ts' \
 *     --profile PowerUserAccess-840513866884 \
 *     --require-approval broadening
 *
 * ─── diff 確認 ───────────────────────────────────────────────────
 *   ./node_modules/.bin/cdk diff --all \
 *     --app 'npx ts-node --prefer-ts-exts bin/rds-app.ts' \
 *     --profile PowerUserAccess-840513866884
 */

import * as cdk from 'aws-cdk-lib';
import { ProdRdsStack } from '../lib/rds-stack';

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

const env: cdk.Environment = { account: awsAccount, region: awsRegion };

const tags = {
  Project: 'moodle-spa',
  Environment: envName,
  ManagedBy: 'cdk-prod',
};

// RDS（prod-VpcStack の VPC を使い回す。VPC は RdsStack 内で fromLookup する）
new ProdRdsStack(app, `${envName}-RdsStack`, {
  env, tags, envName,
  vpcId: 'vpc-06ae1bdbdaa5e3c5d',
});

app.synth();
