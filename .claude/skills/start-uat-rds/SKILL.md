---
name: start-uat-rds
description: UAT環境のRDS(uat-moodle-db)をSSOログイン後、直接起動する。「UATのRDSを起動して」等で使用。
---

# UAT RDS起動

UAT環境（AWSアカウント `822824391912`、スタック `uat-RdsStack`）のRDS `uat-moodle-db` を起動する。prodと違い専用の起動/停止Lambdaは無いため、`aws rds start-db-instance`を直接叩く。

## 手順

### 1. SSOセッションの確認

```
aws sts get-caller-identity --profile PowerUserAccess-822824391912
```

エラーにならず Account が `822824391912` を返せばログイン済みなので、手順2をスキップして手順3へ進む。

### 2. SSOログイン（未ログイン時のみ）

`aws sso login` はインタラクティブなブラウザ認証が必要なコマンドなので、Claude Codeのサンドボックス内で直接実行しても意味がない。ユーザー自身のシェルで実行してもらう必要がある。

1. ユーザーに、プロンプトで以下を `!` 付きで実行するよう伝える（`!` プレフィックスでユーザーのセッション上でコマンドが実行され、出力がそのまま会話に載る）:

   ```
   ! aws sso login --profile PowerUserAccess-822824391912 --no-browser
   ```

   `--no-browser` を付けることで、ローカルでブラウザを自動起動しようとせず、認証用URLと確認コードがテキストで出力される。

2. 出力された認証用URL（`https://device.sso.us-east-1.amazonaws.com/...` 形式）を、claude-in-chrome ツール（`mcp__claude-in-chrome__navigate` 等、未ロードならまず `ToolSearch` でロードする）で新規タブに開く。ツールが使えない/失敗する場合は、URLをそのままユーザーに提示してクリックしてもらう。
3. 表示された確認コードが出力のものと一致することをユーザーに確認してもらい、AWSの認可画面で許可してもらう。
4. 許可後、手順1のコマンドを再実行してログイン成功を確認する。

### 3. 現在の状態を確認

```
aws rds describe-db-instances --profile PowerUserAccess-822824391912 --region ap-northeast-1 \
  --db-instance-identifier uat-moodle-db \
  --query "DBInstances[0].{Id:DBInstanceIdentifier,Status:DBInstanceStatus}" --output table
```

すでに `available` ならスキップ。`stopped` の場合のみ手順4へ。

### 4. 起動

```
aws rds start-db-instance --profile PowerUserAccess-822824391912 --region ap-northeast-1 --db-instance-identifier uat-moodle-db
```

### 5. 起動確認

手順3のコマンドを再実行し、`Status` が `available` になったこと（起動完了まで数分かかる）を確認してユーザーに報告する。
