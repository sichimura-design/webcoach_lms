---
name: stop-dev-moodle-ec2
description: dev環境のmoodle EC2インスタンス（名前に"moodle"を含む）をSSOログインから探して停止する。「dev環境のEC2を止めて」「moodleのEC2を停止して」等で使用。
---

# dev環境 moodle EC2インスタンス停止

dev環境（AWSアカウント `822824391912`）で使っているmoodle用EC2インスタンスを、SSOログイン → 名前検索 → 停止、の流れで止める。

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

### 3. インスタンスを名前で検索

```
aws ec2 describe-instances --profile PowerUserAccess-822824391912 --region ap-northeast-1 \
  --filters "Name=tag:Name,Values=*moodle*" \
  --query "Reservations[].Instances[].{Id:InstanceId,State:State.Name,Name:Tags[?Key=='Name']|[0].Value}" \
  --output table
```

現時点では `dev-moodle-docker` (インスタンスID: `i-06c4ef31eb1ded7ba`) の1台のみがヒットする。複数ヒットした場合はユーザーに確認する。

### 4. 停止

対象インスタンスがすでに `stopped` ならスキップ。`running` の場合のみ、停止して問題ないかユーザーに一声確認してから停止する（他の作業者が使用中の可能性があるため）：

```
aws ec2 stop-instances --profile PowerUserAccess-822824391912 --region ap-northeast-1 --instance-ids <instance-id>
```

### 5. 停止確認

```
aws ec2 describe-instances --profile PowerUserAccess-822824391912 --region ap-northeast-1 --instance-ids <instance-id> \
  --query "Reservations[0].Instances[0].{Id:InstanceId,State:State.Name}" --output table
```

`State` が `stopped` になったことを確認してユーザーに報告する。
