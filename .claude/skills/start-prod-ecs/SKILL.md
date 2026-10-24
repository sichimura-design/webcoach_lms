---
name: start-prod-ecs
description: 本番ECS(prod-lms-cluster/prod-lms-service)をSSOログイン後、既存のprod-ecs-scheduler Lambdaを叩いて起動する。「本番のECSを起動して」等で使用。
---

# 本番ECS起動

本番環境（AWSアカウント `840513866884`）のECS（クラスタ `prod-lms-cluster` / サービス `prod-lms-service`）を、既にデプロイ済みの `prod-ecs-scheduler` Lambda（仕組みは `docs/handover/運用手順.md` の「本番の起動・停止」）経由で起動する。サービス/ASGを直接操作せず、必ずこのLambda経由にする（サービスの`desiredCount`を戻す→ASGを`min/desired`に戻す、という正しい順序と冪等スキップが実装済みのため）。

## ⚠ 前提確認
ECSはRDSに依存するため、RDSが起動していない状態でECSだけ起動してもコンテナが正常に立ち上がらない可能性がある。RDSも同時に起動が必要なら、先に `start-prod-rds` を実行してから本スキルを実行する。

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
  --function-name prod-ecs-scheduler \
  --cli-binary-format raw-in-base64-out \
  --payload '{"action":"start"}' \
  /tmp/prod-ecs-start-response.json
cat /tmp/prod-ecs-start-response.json
```

すでに起動済みなら、Lambda側の冪等ロジックでスキップされる（レスポンス内容を確認）。ASGのスケールアウト→ECSサービスの`desiredCount`復元の順で行われるため、コンテナが実際に`RUNNING`になるまで数分かかる。

### 4. 起動確認

```
aws ecs describe-services --profile PowerUserAccess-840513866884 --region ap-northeast-1 \
  --cluster prod-lms-cluster --services prod-lms-service \
  --query "services[0].{Desired:desiredCount,Running:runningCount,Status:status}" --output table
```

`Running` が `Desired` と一致するまで（必要なら少し待って再実行して）確認し、ユーザーに報告する。
