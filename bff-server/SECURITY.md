# BFF セキュリティドキュメント

## 概要

このドキュメントは、Moodle BFFに実装されているセキュリティ機能について説明します。

## 実装済みセキュリティ機能

### 1. 認証（Authentication）

**目的**: ユーザーが誰であるかを確認する

**実装**: `requireAuth` ミドルウェア (index.js:168-184)

```javascript
// セッションの存在とuserIdをチェック
if (!req.session || !req.session.userId) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**保護対象**: `/api/`配下の全てのエンドポイント（ログイン・ヘルスチェックを除く）

### 2. 認可（Authorization）

**目的**: ユーザーが特定のリソースにアクセスできるかを確認する

**実装**: `requireOwnership` ミドルウェア (index.js:186-213)

```javascript
// リクエストされたuseridとセッションのuserIdを照合
if (parseInt(requestedUserId) !== sessionUserId) {
  return res.status(403).json({
    error: 'Forbidden',
    message: 'You can only access your own data'
  });
}
```

**保護対象エンドポイント**:
- `GET /api/moodle/courses/:userid` - コース一覧取得
- `GET /api/moodle/user-badges/:userid` - バッジ情報取得
- `GET /api/webcoach/profile/:userid` - プロフィール取得
- `POST /api/webcoach/updateprofile/:userid` - プロフィール更新
- `GET /api/webcoach/resumecourse/:userid` - 学習再開情報取得
- `GET /api/webcoach/recomendbadge/:userid` - おすすめバッジ取得

**防御する攻撃**:
- 水平権限昇格（Horizontal Privilege Escalation）
- 他人のデータへの不正アクセス

### 3. 監査ログ（Audit Logging）

**目的**: 全てのAPIリクエストを記録し、セキュリティインシデントの検出と調査を可能にする

**実装**: セキュリティ監査ログミドルウェア (index.js:125-166)

**記録される情報**:
```json
{
  "timestamp": "2025-12-28T12:34:56.789Z",
  "requestId": "1640692496789-abc123def",
  "method": "GET",
  "path": "/api/moodle/courses/10",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "userId": 10,
  "username": "tanaka",
  "params": { "userid": "10" },
  "query": {},
  "status": 200,
  "duration": "123ms"
}
```

**セキュリティアラート**:
- 認証失敗（401）: `AUTHENTICATION_FAILED`
- 認可失敗（403）: `AUTHORIZATION_FAILED`
- サーバーエラー（500+）: `SERVER_ERROR`
- クライアントエラー（400+）: `CLIENT_ERROR`

**ログ形式**:
- 通常ログ: `[AUDIT] {...}`
- 警告ログ: `[AUDIT-ALERT] {...}`
- セキュリティアラート: `[SECURITY ALERT] ...`

### 4. レート制限（Rate Limiting）

**目的**: ブルートフォース攻撃やDDoS攻撃を防止する

**実装**: express-rate-limit (index.js:118-123)

**設定**:
- ウィンドウ: 15分
- 最大リクエスト数: 100回/IP
- 対象: `/api/`配下の全エンドポイント

### 5. セキュリティヘッダー

**目的**: XSS、クリックジャッキングなどのWeb攻撃を防止する

**実装**: Helmet (index.js:70-73)

**有効なヘッダー**:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security（HTTPS環境）

### 6. セッション管理

**設定** (index.js:95-106):

```javascript
{
  secret: SESSION_SECRET,          // 環境変数で設定
  httpOnly: true,                  // JavaScriptからアクセス不可
  secure: NODE_ENV === 'production', // HTTPS必須（本番環境）
  sameSite: 'none'|'lax',         // CSRF対策
  maxAge: 24 * 60 * 60 * 1000     // 24時間
}
```

**保護機能**:
- セッション固定攻撃の防止
- XSSによるセッション窃取の防止
- CSRFの軽減

### 7. サービスアカウント認証

**目的**: エンドユーザーに強力な権限を付与せず、安全にMoodle APIにアクセスする

**実装**:
- BFF起動時にサービスアカウントでログイン
- 取得したトークンをメモリに保存
- 全てのMoodle API呼び出しでサービスアカウントトークンを使用
- 12時間ごとに自動リフレッシュ

**利点**:
- エンドユーザーに `webservice/rest:use` 権限が不要
- トークン管理の集中化
- セキュリティリスクの最小化

### 8. 環境変数検証

**目的**: 設定ミスによるセキュリティホールを防止する

**実装**: validateEnvironment() (index.js:34-64)

**検証項目**:
- 必須環境変数の存在チェック
- 本番環境でのデフォルトパスワード使用の禁止
- 設定値のログ出力（パスワードを除く）

**起動時の動作**:
```
=== Environment Validation ===
✅ All required environment variables are set
   MOODLE_URL: http://moodle-app:8080
   API_SERVER_URL: http://api-server:8001
   MOODLE_SERVICE_USERNAME: service_account
   MOODLE_SERVICE_NAME: moodle_mobile_app
   NODE_ENV: production
```

### 9. ヘルスチェック

**詳細版**: `GET /health`
- サービスアカウントトークンの状態
- Moodle接続確認
- API Server接続確認

**シンプル版**: `GET /api/health`
- サービスアカウントトークンの存在のみチェック
- ロードバランサー用

## セキュリティベストプラクティス

### 環境変数の設定

```bash
# .env ファイル
MOODLE_URL=http://moodle-app:8080
API_SERVER_URL=http://api-server:8001
NODE_ENV=production
SESSION_SECRET=<強力なランダム文字列>
MOODLE_SERVICE_USERNAME=<サービスアカウント名>
MOODLE_SERVICE_PASSWORD=<強力なパスワード>
MOODLE_SERVICE_NAME=moodle_mobile_app
```

### サービスアカウントの設定

1. **専用アカウントの作成**
   - 通常ユーザーとは別の専用アカウント
   - 強力なパスワード設定

2. **権限の最小化**
   - 必要最小限の権限のみ付与
   - `webservice/rest:use` capability
   - 必要なコース・バッジへのアクセス権限

3. **定期的なレビュー**
   - アクセス権限の定期確認
   - 不要な権限の削除

### 本番環境での推奨設定

1. **HTTPS必須**
   - CloudFront、ALB、nginxなどでHTTPS終端
   - セッションCookieの `secure: true`

2. **CORS設定の厳格化**
   - `ALLOWED_ORIGINS` に信頼できるドメインのみ設定
   - ワイルドカードの使用禁止

3. **ログの集約**
   - CloudWatch Logs、ELK、Splunkなどにログ転送
   - セキュリティアラートの監視

4. **定期的なセキュリティ監査**
   - ログの定期確認
   - 異常なアクセスパターンの検出

## 既知の制限事項

### 1. トークンの永続化なし
- サーバー再起動でトークンが消失
- 複数インスタンス環境では各インスタンスが個別にトークン保持

**改善策**: Redis等を使用したトークン共有

### 2. 管理者権限の未実装
- 現在は全ユーザーが自分のデータのみアクセス可能
- 管理者が他ユーザーのデータを管理する機能なし

**改善策**: ロールベースアクセス制御（RBAC）の実装

### 3. トークンリフレッシュ時の競合
- トークン更新中のリクエストが失敗する可能性

**改善策**: グレースフルなトークン切り替え機構の実装

## セキュリティインシデント発生時の対応

### 認可失敗（403）の検出

ログに以下のメッセージが出力されます:

```
[SECURITY ALERT] Authorization FAILED - User 10 (tanaka) attempted to access user 999's data
[SECURITY ALERT] Path: GET /api/moodle/courses/999
[SECURITY ALERT] IP: 192.168.1.1
```

### 対応手順

1. **ログの確認**
   - 該当ユーザーの最近のアクセスログを確認
   - 攻撃パターンの分析

2. **必要に応じてセッション無効化**
   - 疑わしいアクティビティがある場合、該当ユーザーのセッションを削除

3. **パスワードリセット**
   - アカウント侵害の疑いがある場合

4. **IPブロック**
   - 明らかな攻撃の場合、WAFやセキュリティグループでIPをブロック

## テスト方法

### 認可チェックのテスト

```bash
# ユーザー1でログイン
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"pass1"}' \
  -c cookies.txt

# 自分のデータにアクセス（成功）
curl http://localhost:3001/api/moodle/courses/1 \
  -b cookies.txt

# 他人のデータにアクセス（失敗 - 403）
curl http://localhost:3001/api/moodle/courses/999 \
  -b cookies.txt
```

期待される結果:
- 1つ目: 200 OK
- 2つ目: 403 Forbidden `{"error":"Forbidden","message":"You can only access your own data"}`

## まとめ

BFFは以下のセキュリティ機能を実装しています:

✅ 認証（Authentication）
✅ 認可（Authorization）
✅ 監査ログ（Audit Logging）
✅ レート制限（Rate Limiting）
✅ セキュリティヘッダー
✅ セッション管理
✅ サービスアカウント認証
✅ 環境変数検証
✅ ヘルスチェック

これらの機能により、本番環境での安全な運用が可能です。
