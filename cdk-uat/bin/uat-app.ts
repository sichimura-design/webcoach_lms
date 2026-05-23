#!/usr/bin/env node
/**
 * UAT 環境 CDK エントリポイント
 *
 * ─── 全スタック一括デプロイ ───────────────────────────────────────
 *   cd cdk-uat
 *   npm install
 *   ./node_modules/.bin/cdk deploy --all \
 *     --context contentTokenSecret=$(openssl rand -hex 32) \
 *     --context cognitoUserPoolId=ap-northeast-1_xxxx \
 *     --context cognitoClientId=xxxx \
 *     --context cognitoClientSecret=xxxx \
 *     --context anthropicApiKey=sk-ant-xxxx \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 *
 * ─── 差分確認（デプロイ前に必ず実施）───────────────────────────────
 *   ./node_modules/.bin/cdk diff --all \
 *     --profile PowerUserAccess-822824391912
 *
 * ─── 個別スタック更新（例: イメージ更新後に ECS のみ再デプロイ）────
 *   ./node_modules/.bin/cdk deploy uat-BackendStack \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 *
 * ─── 全削除（UAT 環境を破棄する場合）──────────────────────────────
 *   ./node_modules/.bin/cdk destroy --all \
 *     --profile PowerUserAccess-822824391912
 *
 * ─── スタック構成 ───────────────────────────────────────────────
 *   uat-VpcStack       VPC (Multi-AZ, NAT×1)
 *   uat-EcrStack       ECR リポジトリ (nginx / bff / api / moodle)
 *   uat-BackendStack   RDS + EFS + ECS Fargate + ALB (セットで管理)
 *   uat-SpaStack       S3 + CloudFront + Lambda@Edge (us-east-1)
 *
 * ─── デプロイフロー ─────────────────────────────────────────────
 *   1. cdk deploy --all  (ECR 作成)
 *   2. docker build & push → ECR
 *   3. cdk deploy uat-BackendStack  (ECS が ECR イメージを参照)
 *   4. cdk deploy uat-SpaStack  (フロントエンドビルド後)
 *
 * ─── 注意 ───────────────────────────────────────────────────────
 *   - Cognito / Anthropic の値を context で渡さない場合、
 *     デプロイ後に Secrets Manager で手動更新し ECS を再起動すること
 *   - contentTokenSecret は BFF の CONTENT_TOKEN_SECRET と同じ値を使う
 *   - SPA デプロイ前に `cd frontend && npm run build` が必要
 */

import * as cdk from 'aws-cdk-lib';
import { UatVpcStack } from '../lib/vpc-stack';
import { UatEcrStack } from '../lib/ecr-stack';
import { UatBackendStack } from '../lib/backend-stack';
import { UatSpaStack } from '../lib/spa-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'uat';
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-822824391912 を実行するか、\n' +
    '  CDK_DEFAULT_ACCOUNT=<account_id> を環境変数に設定してください。'
  );
}

const env: cdk.Environment = { account: awsAccount, region: awsRegion };

const tags = {
  Project: 'moodle-spa',
  Environment: envName,
  ManagedBy: 'cdk-uat',
};

// ============================================================
// Stack 1: VPC
// ============================================================
const vpcStack = new UatVpcStack(app, `${envName}-VpcStack`, {
  env, tags, envName,
});

// ============================================================
// Stack 2: ECR リポジトリ
// 先にデプロイして docker push 可能な状態にする
// ============================================================
const ecrStack = new UatEcrStack(app, `${envName}-EcrStack`, {
  env, tags, envName,
});

// ============================================================
// Stack 3: バックエンド (RDS + EFS + ECS Fargate + ALB)
// ============================================================
const backendStack = new UatBackendStack(app, `${envName}-BackendStack`, {
  env, tags, envName,
  vpc: vpcStack.vpc,
  nginxRepo: ecrStack.nginxRepo,
  bffRepo: ecrStack.bffRepo,
  apiRepo: ecrStack.apiRepo,
  moodleRepo: ecrStack.moodleRepo,
  // context で渡す。省略時は Secrets Manager で後から手動更新可能。
  cognitoUserPoolId: app.node.tryGetContext('cognitoUserPoolId'),
  cognitoClientId: app.node.tryGetContext('cognitoClientId'),
  cognitoClientSecret: app.node.tryGetContext('cognitoClientSecret'),
  anthropicApiKey: app.node.tryGetContext('anthropicApiKey'),
  moodleSiteUrl: app.node.tryGetContext('moodleSiteUrl'),
  // SSH キーペア名（省略時は SSM Session Manager のみ）
  keyPairName: app.node.tryGetContext('keyPairName'),
  // 初回デプロイ: ECR にイメージがない場合は 0 にする
  desiredCount: Number(app.node.tryGetContext('desiredCount') ?? '1'),
});

// ============================================================
// Stack 4: SPA (S3 + CloudFront + Lambda@Edge)
// Lambda@Edge は us-east-1 に強制されるため env を上書き
// ============================================================
new UatSpaStack(app, `${envName}-SpaStack`, {
  env: { account: awsAccount, region: 'us-east-1' },
  tags,
  envName,
});

// 依存関係の明示
backendStack.addDependency(vpcStack);
backendStack.addDependency(ecrStack);

app.synth();
