---
name: deploy-prod-infra
description: 本番のインフラ(cdk-prod の CDKスタック)の差分確認・反映を、安全スクリプト scripts/deploy-prod.sh 経由で行う。「本番のEcsStackをデプロイして」「cdk-prodの差分を見て」等で使用。アプリ(画面・BFF・api-server)の更新には使わない。
---

# 本番インフラ(cdk-prod)の反映

## まず確認: 本当にこれが必要か
- **画面・BFF・api-server・Moodleイメージの更新は、これを使わない**。dev/kanegae → master へマージすると、
  GitHub Actions(`deploy-backend.yml` / `deploy-frontend.yml`)が自動で本番に出す。
  結果は `gh run list --branch master --limit 6` で確認する。
- これを使うのは `cdk-prod/lib/*.ts` や `cdk-prod/bin/*.ts`(インフラ)を変えたときだけ。

## 手順
1. SSOログインを確認する: `aws sts get-caller-identity --profile PowerUserAccess-840513866884`
   失敗したら、ユーザーに `! aws sso login --profile PowerUserAccess-840513866884 --no-browser` を実行してもらう。
2. 差分を見る(本番は変わらない):
   ```
   cd cdk-prod && ./scripts/deploy-prod.sh diff <スタック名>
   ```
3. 差分をユーザーに日本語で説明する。次が含まれていたら**反映せず止めて相談**する:
   - `[-]`(削除)、`[-/+]` や `replacement`(作り直し)。特に RDS・EFS・ALB・ターゲットグループ・Cognito ユーザープール
   - 想定していないスタック・リソースの変更
4. ユーザーの了承を得てから反映する。端末入力ができないので `--yes` を付ける(フックが確認を求める):
   ```
   cd cdk-prod && ./scripts/deploy-prod.sh deploy <スタック名> --yes
   ```
5. prod-EcsStack なら、最後に表示される desired/running が 2/2 になるまで確認する。

## やってはいけないこと
- `cdk deploy` を直接打つ(フックで止まる)。`--all` での一括デプロイ。
- prod-GithubActionsStack の反映(既定値が REPLACE_ME。スクリプトも受け付けない)。
- `/usr/bin/cdk` を使う(古くて cdk-prod のライブラリを読めない。スクリプトは同梱の node_modules/.bin/cdk を使う)。
