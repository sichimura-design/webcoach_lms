# Moodle User Tracking API

FastAPIベースのユーザー追跡・プロフィール管理APIサーバー

## 機能

### 1. コースアクセス追跡
- ユーザーごとの最終アクセスコースを記録
- アクセス回数のカウント
- 最新アクセス順・アクセス頻度順での取得

### 2. プロフィール設定管理
- テーマ設定（ライト/ダーク）
- 言語設定
- 通知設定
- タイムゾーン設定
- カスタム設定（JSON形式）

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
```

`.env`ファイルを編集してMoodleデータベースの接続情報を設定:

```env
MOODLE_DB_HOST=localhost
MOODLE_DB_PORT=3306
MOODLE_DB_USER=moodleuser
MOODLE_DB_PASSWORD=your_password
MOODLE_DB_NAME=moodle
```

### 2. データベーステーブルの作成

Moodleデータベースに接続して、以下のSQLを実行:

```bash
mysql -h localhost -u moodleuser -p moodle < sql/create_tables.sql
```

または、FastAPIの起動時に自動的にテーブルが作成されます。

### 3. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 4. サーバー起動

#### 開発モード（ホットリロード有効）
```bash
python main.py
```

#### 本番モード
```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

#### Docker
```bash
docker build -t moodle-api-server .
docker run -p 8001:8001 --env-file .env moodle-api-server
```

## API エンドポイント

### ヘルスチェック
```
GET /health
```

### コースアクセス

#### コースアクセスを記録
```
POST /api/course-access
Content-Type: application/json

{
  "userid": 123,
  "courseid": 456
}
```

#### 最終アクセスコース一覧を取得
```
GET /api/users/{userid}/last-courses?limit=10
```

レスポンス例:
```json
[
  {
    "id": 1,
    "userid": 123,
    "courseid": 456,
    "lastaccess": 1701234567,
    "accesscount": 15,
    "course_fullname": "Introduction to Python",
    "course_shortname": "PY101",
    "course_summary": "Learn Python basics"
  }
]
```

#### 最もアクセスの多いコース一覧を取得
```
GET /api/users/{userid}/most-accessed-courses?limit=5
```

### プロフィール設定

#### プロフィール設定を作成
```
POST /api/profile-settings
Content-Type: application/json

{
  "userid": 123,
  "theme": "dark",
  "language": "ja",
  "notifications_enabled": true,
  "email_notifications": true,
  "timezone": "Asia/Tokyo",
  "items_per_page": 20,
  "bio": "Hello, I'm a student!",
  "preferences": {
    "custom_setting": "value"
  }
}
```

#### プロフィール設定を取得
```
GET /api/users/{userid}/profile-settings?auto_create=true
```

`auto_create=true` を指定すると、設定が存在しない場合にデフォルト値で自動作成されます。

#### プロフィール設定を更新（部分更新）
```
PUT /api/users/{userid}/profile-settings
Content-Type: application/json

{
  "theme": "dark",
  "items_per_page": 50
}
```

## API ドキュメント

サーバー起動後、以下のURLでインタラクティブなAPIドキュメントを確認できます:

- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## データベーステーブル

### mdl_user_last_course_access
ユーザーの最終アクセスコース履歴を保存

| カラム | 説明 |
|--------|------|
| userid | Moodleユーザー ID |
| courseid | MoodleコースID |
| lastaccess | 最終アクセス時刻（UNIX timestamp） |
| accesscount | アクセス回数 |

### mdl_user_profile_settings
ユーザーのプロフィール設定を保存

| カラム | 説明 |
|--------|------|
| userid | Moodleユーザー ID（ユニーク） |
| theme | テーマ（light/dark） |
| language | 言語（ja/en） |
| notifications_enabled | 通知有効化 |
| email_notifications | メール通知 |
| timezone | タイムゾーン |
| items_per_page | 表示件数 |
| bio | 自己紹介 |
| preferences | カスタム設定（JSON） |

## トラブルシューティング

### データベース接続エラー
1. `.env`ファイルの接続情報を確認
2. Moodleデータベースへの接続権限を確認
3. ファイアウォール設定を確認

### テーブルが作成されない
SQLファイルを手動で実行:
```bash
mysql -h localhost -u moodleuser -p moodle < sql/create_tables.sql
```

## 本番環境デプロイ

### 推奨設定
- `ENABLE_DOCS=false` でAPIドキュメントを無効化
- HTTPSを使用
- 環境変数をセキュアに管理
- データベース接続プールの設定を調整

## ライセンス

MIT
