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
export {};
