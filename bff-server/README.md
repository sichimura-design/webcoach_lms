# bff-server

WebCoach LMS の BFF（Backend for Frontend）。Express.js (Node.js 18+) で実装し、フロントエンドからのリクエストをすべて受けて認証・認可を行い、Moodle Web Service / api-server / AWS（Cognito, S3, SES）へ中継します。

## 構成

```
bff-server/
├── index.js         # Express アプリ本体（ミドルウェア・ルート登録）
├── config/          # environment.js（環境変数）, clients.js
├── middleware/      # auth / admin / ownership / rateLimit / logging
├── routes/          # エンドポイント（下表）
├── services/        # ビジネスロジック
├── adapters/        # 外部接続: Moodle / ApiServer / Cognito / S3
├── utils/
├── public/          # 静的ファイル（auth.html 等）
└── swagger.yaml     # /api-docs で公開
```

## ルート（`index.js`）

| パス | ファイル | 内容 |
|---|---|---|
| `/api` | `routes/auth.js` | ログイン・ログアウト・ユーザー情報 |
| `/api/moodle` | `routes/moodle.js` | Moodle Web Service 中継（コース・教材） |
| `/api/webcoach` | `routes/webcoach.js` | WebCoach 独自機能（api-server 中継） |
| `/api/admin` | `routes/admin.js` | 管理機能 |
| `/api/faiss` | `routes/faiss.js` | 教材ベクトル取り込み |
| `/api/coaching` | `routes/coaching.js` | コーチング |
| `/api/integrations` | `routes/integrations.js` | Zoom / Google Meet OAuth 連携 |
| `/api/study` | `routes/studySession.js` | 集中ブース学習セッション |
| `/api/roadmap` | `routes/roadmap.js` | キャリアロードマップ |
| `/api/my-note` | `routes/myNote.js` | マイノート |
| `/api-docs` | – | Swagger UI |
| `/health` | – | ヘルスチェック |

## 認証

Cognito の JWT（`aws-jwt-verify` で検証）と、Moodle のサービスアカウントによる Web Service トークンを組み合わせています。セッションは `express-session` で管理します。ユーザー単位のリソースは `middleware/ownership.js` で本人のものか確認してください。

## セットアップ・起動

```bash
cd bff-server
npm install
npm run dev     # nodemon（開発）
npm start       # 本番
```

既定ポートは `3001` です。Docker では `start-with-parameter-store.sh` 経由で起動し、SSM Parameter Store から環境変数を読み込みます。

### 主な環境変数（`config/environment.js`）

| 変数 | 説明 |
|---|---|
| `PORT` | 待ち受けポート（既定 3001） |
| `MOODLE_URL`, `MOODLE_SERVICE_USERNAME`, `MOODLE_SERVICE_PASSWORD`, `MOODLE_SERVICE_NAME` | Moodle Web Service |
| `API_SERVER_URL` | api-server の URL（既定 `http://localhost:8001`） |
| `SESSION_SECRET` | セッション署名キー（必須） |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION` | Cognito |
| `ALLOWED_ORIGINS` | CORS 許可オリジン（カンマ区切り） |
| `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN`, `RECORDINGS_BUCKET_NAME` | S3 / CloudFront |
| `ZOOM_*`, `GOOGLE_*`, `ORGANIZER_GOOGLE_CREDENTIALS_SECRET_ID`, `INTEGRATION_STATE_SECRET`, `INTEGRATION_TOKEN_ENC_KEY` | 会議ツール連携 |
| `REMINDER_ENABLED`, `REMINDER_SENDER_EMAIL`, `TRANSCRIPT_SYNC_ENABLED` | 定期ジョブ |
| `CONTENT_TOKEN_SECRET`, `FRONTEND_BASE_URL` | その他 |

## 注意

- ユーザーに返すエラーメッセージに内部の例外文言をそのまま含めないでください。
- 新しいエンドポイントを追加したら `swagger.yaml` も更新してください。
