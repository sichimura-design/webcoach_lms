# 引き継ぎ資料(WEBCOACH LMS)

このシステムを運用・保守する人のための入口です。上から順に読んでください。

| 読む順 | ファイル | 内容 |
|---|---|---|
| 1 | このファイル | システムの全体像・環境・アカウント・権限 |
| 2 | [運用手順.md](運用手順.md) | 本番への反映、起動・停止、アラートが来たとき |
| 3 | [落とし穴.md](落とし穴.md) | 知らないと事故になること(過去に実際に起きたもの) |
| 4 | [未完了の作業.md](未完了の作業.md) | やりかけ・確認待ち・残っている課題 |
| - | [../support/README.md](../support/README.md) | 受講生・コーチからの問い合わせへの一次対応 |

> リポジトリは公開されています。パスワード・トークン・個人名・メールアドレス・未対応のセキュリティ上の穴は
> ここに書かないでください。それらは非公開の引き継ぎ資料(社内ドライブ等)で管理します。

## 1. 何のシステムか

受講生がオンラインで教材を学び、コーチとの面談(Google Meet)やAIコーチを使えるLMS(学習管理システム)です。

- 受講生向け画面: https://study.webcoach.jp
- バックエンド(API・Moodle管理画面): https://api.webcoach.jp

## 2. 全体の構成

```
 受講生のブラウザ
   │
   ├─ 画面 ─────── CloudFront ── S3(画面のファイル・教材HTML)
   │                            (prod-SpaStack)
   │
   └─ API ──────── ALB ── ECS(EC2 2台。1台に下の4つのコンテナが入る)
                 (prod-AlbStack)  (prod-EcsStack)
                                   ├ nginx       入口。振り分け
                                   ├ bff-server  Node.js。画面からのAPIを受ける・ログイン確認
                                   ├ api-server  Python。独自データ・AIチャット・議事録→AIノート
                                   └ moodle-app  Moodle(教材・受講・学習記録の土台)
                                          │
                                   RDS MySQL prod-lms-db(prod-RdsStack) / EFS(Moodleのファイル)

 ログイン: Cognito(prod-lms-user-pool)。メール送信は SES(noreply@webcoach.jp)
 外部サービス: Anthropic(AI)・Dify(AIアプリ)・Google Workspace(Meet・議事録)・Slack(通知・サポートボット)
```

| ディレクトリ | 中身 |
|---|---|
| `frontend/` | 受講生・コーチ・管理者の画面(React) |
| `bff-server/` | 画面とMoodle・api-serverの間に立つサーバー(Node.js/Express) |
| `api-server/` | 独自テーブル・AIチャット・Dify・議事録(Python/FastAPI) |
| `moodle-app/` | Moodleイメージと自作プラグイン(`customizations/local/webcoach_utils`) |
| `nginx/` | 入口のnginx設定 |
| `cdk-prod/` | **本番**のAWS構成(CDK)。本番はこれだけが正 |
| `cdk/` `cdk-dev/` `cdk-uat/` | dev/uat のAWS構成(本番とは無関係) |
| `docs/support/` | 問い合わせ一次対応マニュアル |
| `.claude/skills/` | Claude Code から使う運用手順(起動・停止・本番インフラ反映) |

## 3. 環境

| 環境 | AWSアカウント | 中身 | 更新のしかた |
|---|---|---|---|
| 本番(prod) | 840513866884 | 上の図のとおり | master へのマージで自動(GitHub Actions) |
| 開発(dev) | 822824391912 | EC2 `dev-moodle-docker` 1台で docker-compose。DBは uat と共用の `uat-moodle-db` | 画面は `dev/**` ブランチへの push で自動(プレビュー)、BFF・apiは手動 |
| UAT | 822824391912 | DB `uat-moodle-db` のみ常用 | - |

AWSへのログインは IAM Identity Center(SSO)です。

```
aws sso login --profile PowerUserAccess-840513866884   # 本番
aws sso login --profile PowerUserAccess-822824391912   # dev/uat
```

## 4. ブランチ

- 開発は `dev/kanegae` で行い push する。`dev/**` への push で dev プレビューに画面が出る
- 本番に出すときは `dev/kanegae` を `master` へマージして push する(→ 自動デプロイ)
- `master` へ直接コミットしない

## 5. 引き継ぐ人の権限(推奨)

| 権限 | 最初に渡すもの | 慣れてから |
|---|---|---|
| 本番AWS | 閲覧のみ(ReadOnly) | 起動・停止、インフラ反映(PowerUser) |
| dev/uat AWS | PowerUser | - |
| GitHub | dev ブランチへの push | master へのマージ |
| Moodle 管理画面 / LMS管理画面 | 管理者 | - |
| Slack `#lms-alert` `#lms-cost-reporting` | 参加 | - |

本番の変更は「master へマージ → 自動デプロイ」の1本に絞っているので、本番AWSの書き込み権限がなくても
日常の更新はできます。

## 6. Claude Code で作業するとき

- ルートの `CLAUDE.md` に作業ルールがあり、Claude Code が自動で読みます
- 本番を変える操作は `.claude/hooks/prod_guard.py` が止める・確認を求めるようになっています
  (本番の `cdk deploy` の直打ちは不可、本番AWSへの書き込みは毎回確認)
- 起動・停止・本番インフラ反映は `.claude/skills/` の手順を使います(「本番のECSを起動して」のように頼む)
