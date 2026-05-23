# CDK 躓きポイント

## 1. `npx cdk` を使わず `cdk` を直接使う

`npx cdk` はローカルの node_modules にある古い/壊れた CDK を使う。
出力が WARNING だけで止まり、diff/synth/deploy が一切動かない。

```bash
# NG
npx cdk diff ...

# OK
cdk diff ...       # /usr/bin/cdk (2.1104.0)
```

## 2. .ts 変更後はコンパイルが必要

`bin/ec2-ami-app.ts` など `.ts` を編集した場合、コンパイル済みの `.js` が存在すると
そちらが使われてしまい変更が反映されない。編集後は必ず再コンパイルする。

```bash
cd cdk && npx tsc --build
```

確認方法：
```bash
grep "変更したキーワード" bin/ec2-ami-app.js
```

## 3. deploy 時の context 変数は全部渡す

既存スタックを更新する際、context 変数を1つでも省略すると、
その変数に依存するリソース（IAM ポリシーなど）が **削除** される。

dev-Ec2AmiStack の deploy コマンド（コピペ用）:
```bash
AWS_PROFILE=PowerUserAccess-822824391912 \
CDK_DEFAULT_ACCOUNT=822824391912 \
CDK_DEFAULT_REGION=ap-northeast-1 \
cdk deploy dev-Ec2AmiStack \
  --app "node bin/ec2-ami-app.js" \
  --context amiId=ami-0c9171efd0ba6a251 \
  --context cognitoUserPoolId=ap-northeast-1_aAPBRNL7D \
  --context s3BucketName=moodle-spa-frontend-spafrontendbucketa0c499f3-1q1oez2ib24b \
  --require-approval never
```

## 4. IAM Policy 変更は EC2 を再作成しない

変更内容によって EC2 が再作成されるかどうか：

| 変更 | EC2 再作成 |
|------|-----------|
| IAM ロールのポリシー追加/更新 | なし ✅ |
| userData 変更 | される ❌ |
| machineImage 変更 | される ❌ |
| instanceType 変更 | される ❌ |

IAM 変更前は `cdk diff` で Resources に EC2 インスタンスが含まれていないか必ず確認する。

## 5. デプロイ前の安全手順

1. AMI バックアップを取る
```bash
aws ec2 create-image \
  --instance-id i-03d39c147698ae58d \
  --name "backup-$(date +%Y%m%d-%H%M%S)" \
  --no-reboot \
  --profile PowerUserAccess-822824391912 \
  --region ap-northeast-1
```

2. `cdk diff` で変更内容を確認（EC2 インスタンスが含まれていないことを確認）

3. `cdk deploy`

## 6. インフラ情報

| 項目 | 値 |
|------|-----|
| EC2 Instance ID | `i-03d39c147698ae58d` |
| EC2 Name | `dev-moodle-docker` |
| IAM Role | `dev-moodle-docker-ec2-role` |
| Elastic IP | `52.194.117.196` |
| S3 Bucket | `moodle-spa-frontend-spafrontendbucketa0c499f3-1q1oez2ib24b` |
| CloudFront Domain | `d1zs9qsimyg41i.cloudfront.net` |
| CloudFront Distribution ID | `E1C5CM5I7NU8VT` |
| Cognito User Pool ID | `ap-northeast-1_aAPBRNL7D` |
