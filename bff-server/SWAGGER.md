# Swagger UI ドキュメント

## 概要

このBFFサーバーには、OpenAPI 3.0仕様に基づいたSwagger UIが組み込まれています。
Swagger UIを使用すると、APIエンドポイントをインタラクティブに探索し、テストすることができます。

## アクセス方法

サーバーが起動している状態で、以下のURLにアクセスしてください:

```
http://localhost:3001/api-docs
```

本番環境の場合:
```
https://your-domain.com/api-docs
```

## 利用可能なAPIカテゴリ

### 1. Health
- サーバーの健全性チェック用エンドポイント

### 2. Authentication
- ユーザー認証とセッション管理
- ログイン、ログアウト、ユーザー情報取得

### 3. Moodle Courses
- コース管理機能
- コース一覧取得、検索、作成、コンテンツ取得
- アクティビティ作成

### 4. Moodle Files
- ファイルアップロード機能

### 5. Moodle Badges
- バッジ管理機能
- バッジ一覧取得、ユーザーバッジ取得

### 6. WebCoach
- AI学習支援機能
- プロフィール管理、コース推奨、ロードマップ、AIチャット

## 認証について

ほとんどのエンドポイントは認証が必要です。Swagger UIで認証が必要なAPIをテストする方法:

1. まず `/api/login` エンドポイントでログインします
2. ログインに成功すると、セッションCookie（`sessionId`）が自動的に設定されます
3. その後、他のAPIエンドポイントをテストできます

## Swagger UIの使い方

### APIエンドポイントをテストする

1. テストしたいエンドポイントをクリックして展開
2. 「Try it out」ボタンをクリック
3. 必要なパラメータやリクエストボディを入力
4. 「Execute」ボタンをクリックしてリクエストを送信
5. レスポンスが下部に表示されます

### リクエスト例

#### ログイン
```json
POST /api/login
{
  "username": "admin",
  "password": "your-password",
  "service": "moodle_mobile_app"
}
```

#### コース一覧取得（認証必須）
```
GET /api/moodle/courses
```

#### コース作成（認証必須）
```json
POST /api/moodle/courses
{
  "fullname": "Introduction to Programming",
  "shortname": "PROG101",
  "categoryid": 1,
  "summary": "This course covers basic programming concepts"
}
```

## 開発時の注意点

### Swagger仕様の更新

`swagger.yaml` ファイルを編集した後、サーバーを再起動する必要があります:

```bash
# ローカル開発の場合
npm run dev

# Docker環境の場合
docker-compose restart bff
```

### サーバーURL の変更

`swagger.yaml` の `servers` セクションで、開発環境と本番環境のURLを設定できます:

```yaml
servers:
  - url: http://localhost:3001
    description: Development server
  - url: https://api.example.com
    description: Production server
```

## トラブルシューティング

### Swagger UIが表示されない

1. サーバーが正しく起動しているか確認
2. `swagger.yaml` ファイルが存在するか確認
3. `swagger-ui-express` と `yamljs` パッケージがインストールされているか確認:
   ```bash
   npm install
   ```

### 認証エラー

- ログインエンドポイントが正しく動作しているか確認
- ブラウザのCookieが有効になっているか確認
- セッション設定（`sameSite`, `secure`など）が環境に適しているか確認

## パッケージ情報

このSwagger UIは以下のパッケージを使用しています:
- `swagger-ui-express`: ^5.0.0
- `yamljs`: ^0.3.0

## 関連ファイル

- `/home/ec2-user/moodle-docker/bff-server/swagger.yaml` - OpenAPI仕様定義
- `/home/ec2-user/moodle-docker/bff-server/index.js` - BFFサーバーメインファイル
- `/home/ec2-user/moodle-docker/bff-server/package.json` - 依存関係定義

## 参考リンク

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-ui-express on npm](https://www.npmjs.com/package/swagger-ui-express)
