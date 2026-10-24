# WEBCOACH LMS — Claude 作業ルール

このリポジトリで Claude が作業するときの必須ルール。
システムの全体像・運用手順・過去の事故は `docs/handover/` にある。作業の前に関係する部分を読むこと。

## 返答
- 返答・報告は日本語で、システムに詳しくない人にも分かる言葉で書く。
- 本番に関わる操作は、何が起きるか(止まる・戻せない等)を実行前に説明し、了承を得る。

## 本番(AWSアカウント 840513866884)
- 本番は受講生が利用中。**止める・消す・作り直す操作は、ユーザーの明示的な指示なしに行わない**。
- アプリ(`frontend/` `bff-server/` `api-server/` `nginx/` `moodle-app/`)の本番反映は
  **dev/kanegae → master のマージだけ**で行う(GitHub Actions が自動デプロイ)。手でイメージを入れ替えない。
- インフラ(`cdk-prod/`)の反映は **`cdk-prod/scripts/deploy-prod.sh` だけ**を使う(スキル `deploy-prod-infra`)。
  `cdk deploy` の直打ち・`--all` は禁止(`.claude/hooks/prod_guard.py` が止める)。
- 差分に削除(`[-]`)・作り直し(`[-/+]`・replacement)が出たら反映せず、ユーザーに報告する。
- 起動・停止は `.claude/skills/` のスキルを使う。ECS・RDS・ASG を直接操作しない。
- 本番の Moodle 自作プラグインはイメージ更新では反映されない(`docs/handover/運用手順.md` 3章)。
- `cdk/` `cdk-dev/` `cdk-uat/` は dev/uat 用。本番の正は `cdk-prod/` だけ。

## 開発
- 作業は `dev/kanegae` ブランチで行い push する。`master` へ直接コミットしない。
- 新しい DB テーブル・カラムが必要になったら、作る前にユーザーへ報告して相談する。
- dev と UAT は同じ DB(`uat-moodle-db`)を使っている。dev での DB 変更は UAT にも効く。
- dev の BFF・api-server は自動では更新されない(`docs/handover/運用手順.md` 4章)。
- リポジトリは公開されている。パスワード・トークン・鍵・個人名・メールアドレス・
  未対応のセキュリティ上の穴をコミット・ドキュメントに書かない(秘密鍵のコミットはフックが止める)。
- 画面・動きを変えたら、`docs/support/`(問い合わせ対応マニュアル)の該当箇所も同じ変更で直す。

## フロントエンドだけを担当する人の場合(dev/<名前> ブランチ)
バックエンドに触らずに画面を作るための仕組みがある。

- 作業対象は `frontend/` のみ。`api-server/` `bff-server/` `swagger.yaml` `cdk*/` は編集しない。
- 実BFFに無い API はフロント側のモック(MSW)で作る:
  1. `frontend/src/services/bffClient.ts` に API メソッドを追加
  2. `frontend/src/mocks/handlers.ts` に対応するモックハンドラを追加(パスは `*/api/...`)
  3. 画面・ルートを作る
  4. `cd frontend && npm start`(既定でモック ON・オフライン)で確認
  サンプル実装「お知らせ」(`/announcements`)が写経のベース。
- `dev/**` への push で Dev Preview が `/branches/<slug>/` に配信される。
- モックは `REACT_APP_ENABLE_MOCKS`(`frontend/src/mocks/config.ts` の `MOCKS_ENABLED`)で切り替わる:
  ローカルは `frontend/.env.development` で ON、プレビューは ON(**dev/kanegae だけは OFF で実認証・実 dev BFF**)、
  本番(master)は OFF。モック時は認証も擬似化(`frontend/src/mocks/mockAuth.ts`、admin + coach)。
- モックにある項目が実バックエンドには無いことがある。モックで動いても実環境で確認すること。
