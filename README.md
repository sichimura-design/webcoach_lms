# Moodle SPA (Single Page Application)

Moodle LMS向けのモダンなReact SPAフロントエンドとBFF (Backend for Frontend)サーバーです。

## 概要

このプロジェクトは以下の構成で動作します：

- **Frontend (React SPA)**: ユーザー向けのモダンなWebアプリケーション
- **BFF Server (Node.js/Express)**: フロントエンドとMoodle/APIサーバー間のプロキシサーバー
- **EC2上のサービス**: Moodle LMS、MySQL、ChromaDB、FastAPI (別途デプロイ)

## 前提条件

- Docker & Docker Compose
- Node.js 18以上 (ローカル開発の場合)
- EC2上で以下が稼働していること：
  - Moodle LMS (Web Service有効化)
  - MySQL/MariaDB
  - ChromaDB (オプション)
  - FastAPI Server (オプション)

## セットアップ手順

### 1. リポジトリのクローンまたはコピー

```bash
cd /home/kanegae100860/moodle-spa
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成します：

```bash
cp .env.example .env
```

`.env`ファイルを編集して、EC2上のサービスエンドポイントを設定します：

```bash
# EC2上のMoodle LMS URL
MOODLE_URL=http://ec2-xx-xx-xx-xx.compute.amazonaws.com

# EC2上のFastAPI Server URL (ChromaDB統合)
API_SERVER_URL=http://ec2-xx-xx-xx-xx.compute.amazonaws.com:8001

# BFF Server URL (通常はローカル)
BFF_URL=http://localhost:3001

# Moodle Web Service Token
MOODLE_TOKEN=your_moodle_webservice_token_here
```

### 3. Moodle Web Serviceトークンの取得

1. MoodleにAdmin権限でログイン
2. `サイト管理 > プラグイン > Web services > 外部サービス`にアクセス
3. 新しいサービスを作成 (例: `moodle_mobile_app`)
4. 必要な関数を有効化：
   - `core_webservice_get_site_info`
   - `core_course_get_courses`
   - `core_course_get_contents`
   - `core_enrol_get_enrolled_users`
   - その他必要な関数
5. `サイト管理 > プラグイン > Web services > トークンの管理`
6. 新しいトークンを作成し、`.env`ファイルに設定

### 4. Dockerコンテナの起動

```bash
docker-compose up -d
```

サービスが起動します：
- Frontend: http://localhost:3000
- BFF Server: http://localhost:3001

### 5. 動作確認

#### BFFサーバーのヘルスチェック
```bash
curl http://localhost:3001/health
```

期待されるレスポンス：
```json
{
  "status": "ok",
  "timestamp": "2025-11-09T20:00:00.000Z",
  "service": "Moodle BFF",
  "environment": "production"
}
```

#### フロントエンドの確認
ブラウザで http://localhost:3000 にアクセス

## 開発環境での起動

### Frontend

```bash
cd frontend
npm install
npm start
```

### BFF Server

```bash
cd bff-server
npm install
npm start
```

## ディレクトリ構成

```
moodle-spa/
├── frontend/               # React SPA
│   ├── src/
│   │   ├── components/     # Reactコンポーネント
│   │   ├── services/       # API通信
│   │   ├── routes/         # ルーティング
│   │   └── utils/          # ユーティリティ
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── bff-server/             # BFF Server (Node.js/Express)
│   ├── index.js            # メインサーバー
│   ├── Dockerfile
│   └── package.json
├── api-server/             # FastAPI Server (Python)
│   ├── main.py             # FastAPIアプリケーション
│   ├── database.py         # データベース接続
│   ├── models.py           # Pydanticモデル
│   ├── schemas.py          # SQLAlchemyモデル
│   ├── crud.py             # CRUD操作
│   ├── requirements.txt    # Python依存パッケージ
│   └── sql/                # SQLスクリプト
│       └── create_tables.sql
├── docker-compose.yml      # Docker設定
├── .env.example            # 環境変数サンプル
└── README.md               # このファイル
```

## 主な機能

- 学習ダッシュボード
- コース一覧・コンテンツ表示
- AIコンテンツチャット (ChromaDB統合)
- コンテンツ登録・管理
- **CSV一括登録** (カテゴリ、コース、ユーザー)
- **ユーザートラッキング** (最終アクセスコース、アクセス履歴)
- **プロフィール設定管理** (テーマ、言語、通知設定など)
- キャリアパス機能
- Markdown & 動画表示
- 数式表示 (KaTeX)
- シンタックスハイライト

## CSV一括登録機能

Moodleの管理画面からCSVを使用してカテゴリ、コース、ユーザーを一括登録できます。

### 提供されているテンプレート

| テンプレートファイル | 用途 | ガイドドキュメント | クイックスタート |
|------------------|------|------------------|-----------------|
| `moodle-category-upload-template.csv` | カテゴリ一括作成 | `MOODLE_CATEGORY_UPLOAD_GUIDE.md` | `QUICK_START_CATEGORY.md` |
| `moodle-course-upload-template.csv` | コース一括作成 | `MOODLE_CSV_GUIDE.md` | - |
| `moodle-user-upload-template.csv` | ユーザー一括作成 | `MOODLE_USER_ENROLLMENT_GUIDE.md` | - |
| `moodle-course-enrollment-template.csv` | コース登録一括実行 | `MOODLE_USER_ENROLLMENT_GUIDE.md` | - |

### ドキュメント一覧

| ドキュメント | 内容 | 対象者 |
|------------|------|--------|
| `CLI_CATEGORY_UPLOAD.md` | **CLIでカテゴリアップロード** | **GUIが使えない場合** |
| `QUICK_START_CATEGORY.md` | カテゴリアップロード5分ガイド（GUI） | 初めての方 |
| `MOODLE_CATEGORY_UPLOAD_STEPS.md` | カテゴリアップロード詳細手順（GUI） | 詳しく知りたい方 |
| `MOODLE_CATEGORY_UPLOAD_GUIDE.md` | カテゴリCSVフォーマット完全ガイド | 管理者 |
| `MOODLE_CSV_GUIDE.md` | コースCSVフォーマット完全ガイド | 管理者 |
| `MOODLE_USER_ENROLLMENT_GUIDE.md` | ユーザー・登録CSVガイド | 管理者 |

### CSV登録の順序

**重要**: 以下の順序で登録してください：

1. **カテゴリ作成** → `moodle-category-upload-template.csv`
   - コースを作成する前に必須
   - カテゴリIDを確認してメモ

2. **コース作成** → `moodle-course-upload-template.csv`
   - カテゴリIDを使用してコースを作成
   - コースIDを確認してメモ

3. **ユーザー作成** → `moodle-user-upload-template.csv`
   - システムにユーザーを追加

4. **コース登録** → `moodle-course-enrollment-template.csv`
   - ユーザーをコースに登録

### カテゴリアップロード方法

#### 方法1: CLI（コマンドライン）- GUIが使えない場合

```bash
# BFFサーバーを起動
cd bff-server
npm start

# 別のターミナルでカテゴリをアップロード
cd /home/kanegae100860/moodle-spa
node upload-categories.js moodle-category-upload-template.csv admin adminpassword
```

詳しくは `CLI_CATEGORY_UPLOAD.md` を参照してください。

#### 方法2: GUI（Moodle管理画面）

Moodleバージョン3.7以上の場合:
1. Moodle管理画面にログイン
2. **サイト管理 > コース > カテゴリをアップロード**
3. CSVファイルをアップロード

詳しくは `QUICK_START_CATEGORY.md` または `MOODLE_CATEGORY_UPLOAD_STEPS.md` を参照してください。

### よくあるエラー

#### "カテゴリIDでカテゴリを解決できませんでした"

**原因**: コースCSVで指定したカテゴリIDが存在しない

**解決方法**:
1. 先に `MOODLE_CATEGORY_UPLOAD_GUIDE.md` または `CLI_CATEGORY_UPLOAD.md` を参照してカテゴリを作成
2. Moodle管理画面またはCLI実行結果でカテゴリIDを確認
3. コースCSVの `category` フィールドを正しいIDに更新

詳しくは各ガイドドキュメントを参照してください。

## トラブルシューティング

### BFFサーバーが起動しない

1. `.env`ファイルが正しく設定されているか確認
2. EC2上のMoodleにアクセスできるか確認
   ```bash
   curl -I ${MOODLE_URL}
   ```
3. ログを確認
   ```bash
   docker-compose logs bff-server
   ```

### フロントエンドがBFFに接続できない

1. BFFサーバーが起動しているか確認
   ```bash
   docker-compose ps
   ```
2. `REACT_APP_BFF_URL`が正しく設定されているか確認
3. CORSエラーの場合は、BFFサーバーの`ALLOWED_ORIGINS`を確認

### Moodle APIエラー

1. Moodle Web Serviceが有効化されているか確認
2. トークンが有効か確認
3. 必要な関数が有効化されているか確認

## ユーザートラッキング機能

ユーザーの学習行動を追跡し、パーソナライズされた学習体験を提供します。

### 機能概要

1. **最終アクセスコース追跡**
   - ユーザーごとの最後にアクセスしたコースを記録
   - アクセス回数を自動カウント
   - 最近アクセスしたコース一覧を表示

2. **プロフィール設定管理**
   - テーマ設定（ライト/ダーク）
   - 言語設定（日本語/英語）
   - 通知設定
   - タイムゾーン設定
   - カスタム設定（JSON形式で拡張可能）

### セットアップ

詳細なセットアップ手順は `USER_TRACKING_IMPLEMENTATION_GUIDE.md` を参照してください。

#### 1. データベーステーブルの作成

```bash
mysql -h <MOODLE_DB_HOST> -u <MOODLE_DB_USER> -p <MOODLE_DB_NAME> < api-server/sql/create_tables.sql
```

#### 2. FastAPIサーバーのセットアップ

```bash
cd api-server
cp .env.example .env
# .envファイルを編集してMoodleデータベースの接続情報を設定

pip install -r requirements.txt
python main.py
```

#### 3. API利用例

**コースアクセスを記録:**
```bash
curl -X POST http://localhost:3001/api/user-tracking/course-access \
  -H "Content-Type: application/json" \
  -d '{"courseid": 123}' \
  --cookie "sessionId=your_session_id"
```

**最終アクセスコース一覧を取得:**
```bash
curl http://localhost:3001/api/user-tracking/last-courses?limit=10 \
  --cookie "sessionId=your_session_id"
```

**プロフィール設定を取得:**
```bash
curl http://localhost:3001/api/profile-settings?auto_create=true \
  --cookie "sessionId=your_session_id"
```

### データベーステーブル

- `mdl_user_last_course_access` - ユーザーの最終アクセスコース履歴
- `mdl_user_profile_settings` - ユーザープロフィール設定

詳細なテーブル定義は `api-server/sql/create_tables.sql` を参照してください。

## ライセンス

MIT

## 注意事項

- **Notion MCP機能は含まれていません** (要件により削除済み)
- **Moodle本体は含まれていません** (EC2上で別途デプロイ)
- セッションは現在メモリベース (再起動すると失われます)
- 本番環境ではRedis等の永続化ストレージの使用を推奨
