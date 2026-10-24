---
name: start-prod-rds
description: 本番RDS(prod-lms-db)をSSOログイン後、既存のprod-rds-scheduler Lambdaを叩いて起動する。「本番のRDSを起動して」等で使用。
---

# 本番RDS起動

本番環境（AWSアカウント `840513866884`）のRDS `prod-lms-db` を、既にデプロイ済みの `prod-rds-scheduler` Lambda（仕組みは `docs/handover/運用手順.md` の「本番の起動・停止」）経由で起動する。DBインスタンスを直接操作せず、必ずこのLambda経由にする（冪等スキップやロジックが実装済みのため）。

## ⚠ 前提確認
本番が実ユーザーに公開済み（稼働時間が読めない状態）の場合、このLambdaは元々「開放前のコスト削減」目的のものなので使い方に注意。起動自体は基本安全だが、ユーザーに一声「本番RDSを起動します」と伝えてから実行する。

## 手順

### 1. SSOセッションの確認

```
aws sts get-caller-identity --profile PowerUserAccess-840513866884
```

エラーにならず Account が `840513866884` を返せばログイン済みなので、手順2をスキップして手順3へ進む。

### 2. SSOログイン（未ログイン時のみ）

`aws sso login` はインタラクティブなブラウザ認証が必要なコマンドなので、Claude Codeのサンドボックス内で直接実行しても意味がない。ユーザー自身のシェルで実行してもらう必要がある。

1. ユーザーに、プロンプトで以下を `!` 付きで実行するよう伝える（`!` プレフィックスでユーザーのセッション上でコマンドが実行され、出力がそのまま会話に載る）:

   ```
   ! aws sso login --profile PowerUserAccess-840513866884 --no-browser
   ```

   `--no-browser` を付けることで、ローカルでブラウザを自動起動しようとせず、認証用URLと確認コードがテキストで出力される。

2. 出力された認証用URL（`https://device.sso.us-east-1.amazonaws.com/...` 形式）を、claude-in-chrome ツール（`mcp__claude-in-chrome__navigate` 等、未ロードならまず `ToolSearch` でロードする）で新規タブに開く。ツールが使えない/失敗する場合は、URLをそのままユーザーに提示してクリックしてもらう。
3. 表示された確認コードが出力のものと一致することをユーザーに確認してもらい、AWSの認可画面で許可してもらう。
4. 許可後、手順1のコマンドを再実行してログイン成功を確認する。

### 3. Lambda呼び出しで起動

```
aws lambda invoke --profile PowerUserAccess-840513866884 --region ap-northeast-1 \
  --function-name prod-rds-scheduler \
  --cli-binary-format raw-in-base64-out \
  --payload '{"action":"start"}' \
  /tmp/prod-rds-start-response.json
cat /tmp/prod-rds-start-response.json
```

すでに起動済みなら、Lambda側の冪等ロジックでスキップされる（レスポンス内容を確認）。

### 4. 起動確認

```
aws rds describe-db-instances --profile PowerUserAccess-840513866884 --region ap-northeast-1 \
  --db-instance-identifier prod-lms-db \
  --query "DBInstances[0].{Id:DBInstanceIdentifier,Status:DBInstanceStatus}" --output table
```

`Status` が `available` になったこと（起動完了まで数分かかる場合がある）を確認してユーザーに報告する。
