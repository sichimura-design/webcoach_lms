#!/usr/bin/env node
/**
 * Dev Preview 環境 CDK エントリポイント
 *
 * ─── アカウント情報 ───────────────────────────────────────────────
 *   アカウント: 822824391912
 *   プロファイル: PowerUserAccess-822824391912
 *
 * ─── 初回デプロイ手順 ─────────────────────────────────────────────
 *
 *   cd cdk-dev
 *   npm install
 *   export AWS_PROFILE=PowerUserAccess-822824391912
 *   export CDK_DEFAULT_ACCOUNT=822824391912
 *   export CDK_DEFAULT_REGION=ap-northeast-1
 *
 *   # GitHub OIDC プロバイダーが 822824391912 に未存在の場合（初回のみ）
 *   npm run deploy
 *
 *   # 既に OIDC プロバイダーが存在する場合
 *   node_modules/.bin/cdk deploy --all \
 *     --context oidcProviderArn=arn:aws:iam::822824391912:oidc-provider/token.actions.githubusercontent.com \
 *     --app 'npx ts-node --prefer-ts-exts bin/dev-app.ts' \
 *     --require-approval never
 *
 * ─── Outputs を GitHub Secrets に登録 ────────────────────────────
 *   デプロイ後に出力される値を以下の Secret 名で登録:
 *     dev-dev-BucketName        → S3_BUCKET_NAME_DEV
 *     dev-dev-DistributionId    → CLOUDFRONT_DISTRIBUTION_ID_DEV
 *     dev-dev-CloudFrontDomain  → CLOUDFRONT_DOMAIN_DEV
 *     dev-dev-PreviewRoleArn    → AWS_DEV_PREVIEW_ROLE_ARN
 *
 * ─── スタック構成 ───────────────────────────────────────────────
 *   dev-DevSpaStack          S3 + CloudFront + CloudFront Function
 *   dev-DevGithubActionsStack  OIDC ロール (dev/** + master)
 *
 * ─── CloudFront 作成には 10〜15 分かかります（初回のみ）───────────
 */

import * as cdk from 'aws-cdk-lib';
import { DevSpaStack } from '../lib/dev-spa-stack';
import { DevGithubActionsStack } from '../lib/dev-github-actions-stack';

const app = new cdk.App();

const envName = 'dev';
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-822824391912\n' +
    '  export CDK_DEFAULT_ACCOUNT=822824391912\n' +
    '  export CDK_DEFAULT_REGION=ap-northeast-1'
  );
}

const env: cdk.Environment = { account: awsAccount, region: awsRegion };
const tags = { Project: 'moodle-spa', Environment: envName, ManagedBy: 'cdk-dev' };

const spaStack = new DevSpaStack(app, `${envName}-DevSpaStack`, {
  env, tags, envName,
});

new DevGithubActionsStack(app, `${envName}-DevGithubActionsStack`, {
  env, tags, envName,
  githubRepo: 'sichimura-design/webcoach_lms',
  bucket: spaStack.bucket,
  distribution: spaStack.distribution,
  oidcProviderArn: app.node.tryGetContext('oidcProviderArn'),
});

app.synth();
