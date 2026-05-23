# SPA (S3 + CloudFront) デプロイ手順

## 概要

フロントエンド SPA を S3 + CloudFront に CDK でデプロイする手順。
既存の VPC / EC2 / RDS 等のスタックには一切影響しない独立構成。

- **スタック名**: `moodle-spa-frontend`
- **エントリポイント**: `cdk/bin/spa-deploy-app.ts`
- **スタック定義**: `cdk/lib/spa-frontend-stack.ts`
- **プロファイル**: `PowerUserAccess-822824391912`
- **リージョン**: `ap-northeast-1`

---

## 事前確認

```bash
# 認証確認
aws sts get-caller-identity --profile PowerUserAccess-822824391912

# 既存スタック一覧（影響範囲の確認）
aws cloudformation list-stacks \
  --profile PowerUserAccess-822824391912 \
  --region ap-northeast-1 \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[].StackName'

# ビルド成果物の確認
ls frontend/build/
# index.html, static/ (css/ js/ media/) が存在すること
```

---

## フロントエンドビルド

```bash
cd frontend
npm run build
# → frontend/build/ に成果物が生成される
```

---

## CDK デプロイ

> **重要**: `npx cdk` は動作しない。`./node_modules/.bin/cdk` を使うこと。

```bash
cd cdk

# スタック認識確認（dry run）
./node_modules/.bin/cdk ls \
  --app "npx ts-node --prefer-ts-exts bin/spa-deploy-app.ts"

# テンプレート確認（CloudFormation テンプレートを出力）
./node_modules/.bin/cdk synth moodle-spa-frontend \
  --app "npx ts-node --prefer-ts-exts bin/spa-deploy-app.ts" \
  --profile PowerUserAccess-822824391912

# デプロイ
./node_modules/.bin/cdk deploy moodle-spa-frontend \
  --app "npx ts-node --prefer-ts-exts bin/spa-deploy-app.ts" \
  --profile PowerUserAccess-822824391912 \
  --require-approval never
```

---

## デプロイ後の確認

```bash
# CloudFront URL / S3 バケット名は Outputs に表示される
# Outputs:
#   moodle-spa-frontend.CloudFrontDomainName = d1zs9qsimyg41i.cloudfront.net
#   moodle-spa-frontend.BucketName = moodle-spa-frontend-spafrontendbucketa0c499f3-1q1oez2ib24b
```

ブラウザで `https://d1zs9qsimyg41i.cloudfront.net` にアクセスして SPA が表示されることを確認。

---

## リソース構成

```
CloudFront Distribution (d1zs9qsimyg41i.cloudfront.net)
  └── OAC (Origin Access Control)
        └── S3 Bucket (プライベート, S3_MANAGED 暗号化)
              └── SPA ビルド成果物 (frontend/build/)
                    ├── index.html
                    └── static/ (css, js, media)

補助リソース:
  - Lambda (BucketDeployment カスタムリソース): S3 へのアップロード処理
  - Lambda (AutoDeleteObjects カスタムリソース): スタック削除時のバケット空にする処理
```

### 403/404 フォールバック

SPA のクライアントサイドルーティング対応のため、403/404 は `index.html` (HTTP 200) を返す設定。

---

## 既存リソースへの影響

| スタック | 影響 |
|---|---|
| dev-VpcStack | なし |
| dev-Ec2AmiStack | なし |
| dev-CognitoStack | なし |
| その他 nexus-* / common-* | なし |

`--app` フラグで `bin/spa-deploy-app.ts` のみを使用するため、`cdk.json` デフォルトの `bin/cdk.ts`（全スタック）は実行されない。

---

## 更新デプロイ（ビルド成果物の差し替え）

フロントエンドを更新してデプロイする場合:

```bash
# 1. フロントエンドビルド
cd frontend && npm run build

# 2. 再デプロイ（CDK が差分を検知して S3 を更新 + CloudFront キャッシュ無効化）
cd cdk && ./node_modules/.bin/cdk deploy moodle-spa-frontend \
  --app "npx ts-node --prefer-ts-exts bin/spa-deploy-app.ts" \
  --profile PowerUserAccess-822824391912 \
  --require-approval never
```

---

## スタック削除

```bash
cd cdk && ./node_modules/.bin/cdk destroy moodle-spa-frontend \
  --app "npx ts-node --prefer-ts-exts bin/spa-deploy-app.ts" \
  --profile PowerUserAccess-822824391912
```

`RemovalPolicy.DESTROY` + `autoDeleteObjects: true` のため、S3 バケットごと削除される。
