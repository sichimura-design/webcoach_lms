# cdk

WebCoach LMS の AWS インフラ（AWS CDK / TypeScript）。**このディレクトリは dev / uat 用です。** 本番（prod、別 AWS アカウント）は `../cdk-prod/` を使います。

## スタック（`bin/cdk.ts`）

スタック名は `${env}-<Name>` です（例: `dev-VpcStack`）。

| スタック | ファイル | 内容 |
|---|---|---|
| VpcStack | `lib/vpc-stack.ts` | VPC・サブネット |
| S3Stack | `lib/s3-stack.ts` | S3 バケット |
| CognitoStack | `lib/cognito-stack.ts` | ユーザープール |
| RdsStack | `lib/rds-stack.ts` | Moodle 用 RDS (MySQL) |
| AuroraStack | `lib/aurora-stack.ts` | Aurora |
| EcrStack | `lib/ecr-stack.ts` | コンテナリポジトリ |
| Ec2Stack | `lib/ec2-stack.ts` | dev 用 EC2（docker-compose 実行環境） |
| EcsStack | `lib/ecs-stack.ts` | ECS（uat/prod 向け） |

ほかのエントリポイント: `bin/cognito-app.ts`（Cognito のみ）、`bin/spa-deploy-app.ts`（SPA 配信）、`bin/ec2-ami-app.ts`（AMI）。

## 使い方

```bash
cd cdk
npm install
npx tsc --build                 # .ts を編集したら必ずコンパイル
cdk diff  -c env=dev
cdk deploy -c env=dev <StackName>
```

- `npx cdk` ではなく、グローバルの `cdk`（2.1104.0）を使ってください。
- context 変数（`-c env=...` など）は **既存デプロイ時と同じものをすべて渡してください。** 省略すると既存リソースが削除されることがあります。
- IAM ポリシーを変えても EC2 は再作成されません。deploy 前に必ず `cdk diff` を確認してください。
- 対象アカウント・リージョンは `CDK_DEFAULT_ACCOUNT` / `-c region=...`（既定 `ap-northeast-1`）で決まります。

## 関連ディレクトリ

| ディレクトリ | 用途 |
|---|---|
| `../cdk-prod/` | 本番用（独立した npm プロジェクト）。新規スタックは既存 construct を直接参照せず、ARN/ID 文字列 + context 変数で渡す |
| `../cdk-dev/` | dev 用の別エントリ（`bin/dev-app.ts`） |
