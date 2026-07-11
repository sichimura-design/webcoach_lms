# Swagger UIでAPIをテストする方法

## 概要

Swagger UIを使用して、Cognito JWT認証が必要なBFF APIをテストできます。

## アクセス方法

### ローカル環境
```
http://localhost:3001/api-docs
```

### 本番環境
```
https://52.194.117.196/api-docs
```

## テスト手順

### ステップ1: Cognito IDトークンを取得

#### 方法A: ブラウザから取得（最も簡単！）

1. ブラウザで認証ページを開く:
   ```
   http://localhost:3001/auth.html
   ```

2. Cognitoアカウントでログイン:
   - メールアドレスを入力
   - パスワードを入力
   - 「ログイン」ボタンをクリック

3. ログイン成功後、IDトークンが表示されます

4. 「📋 トークンをコピー」ボタンをクリック

5. そのまま「🔗 Swagger UIを開く」ボタンをクリックするか、
   手動で `/api-docs` を開く

**利点**:
- コマンドライン不要
- トークンが自動的にクリップボードにコピーされる
- ユーザー情報と有効期限が確認できる
- Swagger UIへ直接移動可能

#### 方法B: シェルスクリプトを使用

```bash
cd bff-server
./get-token.sh your-email@example.com YourPassword123!
```

実行後、`.id-token`ファイルにトークンが保存され、コンソールに表示されます。

#### 方法C: AWS CLIを使用

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 23jacbr6nk4baiftjueddmr4kb \
  --auth-parameters USERNAME=your-email@example.com,PASSWORD=YourPassword123! \
  --region ap-northeast-1 \
  --output json
```

レスポンスの`AuthenticationResult.IdToken`をコピーします。

#### 方法D: Node.jsスクリプトを使用

```bash
cd bff-server
npm install  # 初回のみ
node test-auth.js your-email@example.com YourPassword123!
```

### ステップ2: Swagger UIで認証設定

1. ブラウザで`http://localhost:3001/api-docs`を開く

2. 右上の **🔒 Authorize** ボタンをクリック

3. `bearerAuth`セクションで、取得したIDトークンを入力
   - **注意**: `Bearer`プレフィックスは不要です
   - トークンのみを貼り付けてください

   例:
   ```
   eyJraWQiOiJwV1wvXC9cL3pSOE1HS0RCT3BYZnVzY3JVMEdSeGw5...（長いトークン）
   ```

4. **Authorize** ボタンをクリック

5. ✅ ロックアイコンが緑色になれば成功

### ステップ3: APIエンドポイントをテスト

#### 例1: コース一覧を取得

1. `Moodle Courses`セクションを展開
2. `GET /api/moodle/courses`を選択
3. **Try it out** ボタンをクリック
4. **Execute** ボタンをクリック
5. レスポンスを確認

#### 例2: プロフィールを取得

1. `WebCoach`セクションを展開
2. `GET /api/webcoach/profile/{userid}`を選択
3. **Try it out** ボタンをクリック
4. `userid`パラメータに自分のMoodle User IDを入力（例: `2`）
5. **Execute** ボタンをクリック
6. レスポンスを確認

#### 例3: AIチャット

1. `WebCoach`セクションを展開
2. `POST /api/webcoach/ai`を選択
3. **Try it out** ボタンをクリック
4. Request bodyを編集:
   ```json
   {
     "message": "プログラミングを学ぶためのおすすめコースを教えてください",
     "user_id": 2,
     "max_chunks": 5,
     "use_tools": false
   }
   ```
5. **Execute** ボタンをクリック
6. AIの応答を確認

## トークンの有効期限

- IDトークンの有効期限: **1時間**
- 期限切れの場合、再度ステップ1からトークンを取得してください

### トークン期限切れエラー

```json
{
  "error": "Unauthorized",
  "message": "トークンが無効です"
}
```

このエラーが出た場合は、新しいトークンを取得して再度Authorizeしてください。

## よくある問題

### 1. 401 Unauthorized エラー

**原因**:
- トークンが設定されていない
- トークンの有効期限切れ
- トークンが正しくない

**解決方法**:
- Authorizeボタンで正しいトークンを設定
- トークンを再取得してAuthorize

### 2. 403 Forbidden エラー

**原因**:
- 他のユーザーのデータにアクセスしようとしている
- Moodleユーザーとの紐付けがない

**解決方法**:
- 自分のuseridでアクセスする
- CognitoのemailとMoodleのemailが一致しているか確認

### 3. "No Moodle user found" エラー

**原因**:
- CognitoのemailアドレスとMoodleのemailアドレスが一致しない

**解決方法**:
1. Cognitoユーザーのemailを確認:
   ```bash
   aws cognito-idp admin-get-user \
     --user-pool-id ap-northeast-1_aAPBRNL7D \
     --username your-username
   ```

2. Moodleで同じemailアドレスのユーザーを作成または更新

## トークンのデバッグ

### トークンの中身を確認

```bash
# トークンをデコード（ペイロード部分のみ）
echo "YOUR_ID_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

表示される情報:
```json
{
  "sub": "12345678-1234-1234-1234-123456789abc",
  "email": "user@example.com",
  "cognito:username": "user@example.com",
  "exp": 1234567890,
  "iat": 1234564290
}
```

- `sub`: CognitoユーザーID
- `email`: メールアドレス（Moodle検索に使用）
- `exp`: 有効期限（UNIXタイムスタンプ）

## セキュリティ上の注意

⚠️ **重要**:
- トークンは他人と共有しないでください
- トークンをGitにコミットしないでください
- Swagger UIはローカル開発・テスト用です
- 本番環境では適切なアクセス制御を設定してください

## 参考

- [TEST_API_AUTH.md](./TEST_API_AUTH.md) - その他の認証テスト方法
- [COGNITO_AUTH_MIGRATION.md](./COGNITO_AUTH_MIGRATION.md) - 認証システムの詳細
