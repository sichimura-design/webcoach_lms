---
name: enable-prod-scheduler
description: 本番RDS/ECSの自動起動・停止スケジューラ(EventBridgeルール)をSSOログイン後に再度ONにする。「本番のスケジューラを有効化して」「自動起動をまた入れて」等で使用。2026-08-06にRDS/ECSを手動停止した際に4本とも無効化した対。
---

# 本番RDS/ECS自動起動・停止スケジューラの有効化

> ⚠ **本番は受講生が利用中です(2026-10〜)。止めると全員が使えなくなります。**
> 障害対応などで責任者の指示がある場合以外は使わないでください。実行前に必ず人に確認すること。

本番環境（AWSアカウント `840513866884`）には、コスト削減目的でRDS/ECSを自動的に停止・起動するEventBridgeルールが4本ある（仕組みは `docs/handover/運用手順.md` の「本番の起動・停止」）。2026-08-06にRDS/ECSを手動停止した際にこれらを全てDISABLEDにした。本スキルはそれを再度ENABLEDに戻す。

対象ルール:
- `prod-rds-start-schedule`
- `prod-rds-stop-schedule`
- `prod-ecs-start-schedule`
- `prod-ecs-stop-schedule`

（`prod-rds-maintenance-ec2-force-stop-schedule` はRDSメンテ用EC2専用の別ルールなので対象外。常にENABLEDのまま運用する）

## ⚠ 実行前に必ず確認すること
- **本番が実ユーザーに公開済み**（≒いつアクセスがあるか分からない状態）であれば、このスケジューラは「決め打ちの時間帯(01:00-19:00 JST等)でRDS/ECSを落とす」動きをするため、実運用中は有効化してはいけない。有効化する前に、本番が未公開のまま検証待機中であることをユーザーに確認する。
- 有効化すると、次回のスケジュール時刻に合わせてRDS/ECSが自動的に停止・起動される。今すぐ即座に起動したいだけなら、このスキルではなく `start-prod-rds` / `start-prod-ecs` を使う。

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

### 3. 現在の状態を確認

```
aws events list-rules --profile PowerUserAccess-840513866884 --region ap-northeast-1 \
  --query "Rules[?contains(Name, 'rds') || contains(Name, 'ecs')].{Name:Name,State:State}" --output table
```

### 4. 4本のルールを有効化

```
aws events enable-rule --profile PowerUserAccess-840513866884 --region ap-northeast-1 --name prod-rds-start-schedule
aws events enable-rule --profile PowerUserAccess-840513866884 --region ap-northeast-1 --name prod-rds-stop-schedule
aws events enable-rule --profile PowerUserAccess-840513866884 --region ap-northeast-1 --name prod-ecs-start-schedule
aws events enable-rule --profile PowerUserAccess-840513866884 --region ap-northeast-1 --name prod-ecs-stop-schedule
```

### 5. 有効化確認

手順3のコマンドを再実行し、4本とも `ENABLED` になっていることを確認してユーザーに報告する。

## 補足: RDSスケジューラLambdaの既知の不具合修正(2026-08-06)
`prod-rds-scheduler` LambdaのIAMロールポリシーが、旧DB識別子 `prod-lms-db` のARNに固定されていたため、実際のRDS識別子 `prod-lms-db` に対して `AccessDenied` で失敗する不具合があった。2026-08-06に以下を手動修正済み:
- Lambda環境変数 `DB_INSTANCE_IDENTIFIER` を `prod-lms-db` に変更
- IAMロール `prod-RdsSchedulerStack-RdsSchedulerFunctionServiceR-*` のインラインポリシーのResourceを `arn:aws:rds:ap-northeast-1:840513866884:db:prod-lms-db` に変更

この修正はCDK(`cdk/lib/rds-scheduler-stack.ts`のcontext `rdsInstanceIdentifier=prod-lms-db`)とはドリフトしている。今後 `cdk deploy` でこのスタックを再デプロイする際は、`--context rdsInstanceIdentifier=prod-lms-db` を指定するか、CDKコード側のデフォルト値を修正してから実行すること。忘れると再デプロイ時にIAMポリシーが古いARNに巻き戻り、再びスケジューラが失敗する。
