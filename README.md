# Moodle SPA (WEBCOACH)

Moodle をバックエンドにした学習用 SPA。docker-compose で Moodle・API サーバー・BFF・nginx を起動する（DB は RDS を使用）。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `frontend/` | React + TypeScript + Tailwind の SPA |
| `bff-server/` | Express.js の BFF（Moodle セッション認証・Cognito） |
| `api-server/` | Python の API サーバー（WEBCOACH 独自テーブル・AI チャット） |
| `moodle-app/` | Moodle イメージのカスタマイズ |
| `nginx/` | リバースプロキシ |
| `cdk/` `cdk-dev/` `cdk-prod/` | AWS インフラ（CDK） |
| `scripts/` | DB 移行・Parameter Store 等の運用スクリプト |
| `assets/` | 教材・サムネイルの原本（ビルド対象外） |

## 起動・停止

```bash
docker compose up -d      # 起動
docker compose logs -f    # ログ確認
docker compose down       # 停止
```

## Moodle APIユーザー（apiuser）のトークン

BFF / API サーバーから Moodle API を使うためのサービスアカウント。`setup-apiuser.sql` でアカウント・ロール・Web サービスを設定し、トークンは Moodle 管理画面で発行する：

1. Moodle に管理者でログイン
2. サイト管理 > サーバ > Webサービス > トークンを管理する
3. ユーザー: apiuser、サービス: moodle-api-service でトークンを作成
4. 生成されたトークンを `.env` に設定

## BFF（Backend for Frontend）の設定

### サービスアカウントの設定

BFFは全てのMoodle API呼び出しにサービスアカウントを使用します。`.env`ファイルで以下の環境変数を設定してください：

```bash
# .env ファイル
MOODLE_SERVICE_USERNAME=your_service_account_username
MOODLE_SERVICE_PASSWORD=your_service_account_password
MOODLE_SERVICE_NAME=moodle_mobile_app
```

### 重要な注意点

1. **認証の仕組み**：
   - エンドユーザーのログイン認証はBFFで管理
   - Moodle APIへのアクセスは全てサービスアカウントのトークンで実行
   - サービスアカウントのトークンは12時間ごとに自動更新

2. **セキュリティ**：
   - サービスアカウントには必要最小限の権限のみを付与
   - `webservice/rest:use` capabilityが必要
   - エンドユーザーには`webservice/rest:use`を付与する必要はありません

3. **BFFの起動**：
   - サービスアカウントの認証情報が設定されていない場合、BFFは起動に失敗します
   - 起動時にサービスアカウントでログインしてトークンを取得します

## システム要件

- Docker 20.10以降（docker compose）
- 空きディスク容量: 最低5GB
- メモリ: 最低2GB推奨
