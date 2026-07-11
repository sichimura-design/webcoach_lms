# ブラウザベース認証ページ

## 概要

`auth.html` は、ブラウザから直接Cognito認証を行い、IDトークンを取得できるページです。

## アクセス方法

### ローカル環境
```
http://localhost:3001/auth.html
```

### 本番環境
```
https://52.194.117.196/auth.html
```

## 機能

### ✨ 主な機能

1. **Cognitoログイン**
   - メールアドレスとパスワードで認証
   - amazon-cognito-identity-js を使用
   - セキュアな認証フロー

2. **IDトークン表示**
   - ログイン成功後、IDトークンを表示
   - ワンクリックでクリップボードにコピー
   - トークンの有効期限を表示

3. **ユーザー情報表示**
   - Email
   - Cognito Username
   - Cognito Sub (ユーザーID)
   - トークン有効期限

4. **Swagger UI連携**
   - トークン取得後、直接Swagger UIを開ける
   - シームレスなテスト体験

## 使い方

### ステップ1: 認証ページを開く

ブラウザで `http://localhost:3001/auth.html` を開く

### ステップ2: ログイン

1. メールアドレスを入力
2. パスワードを入力
3. 「ログイン」ボタンをクリック

### ステップ3: トークンをコピー

ログイン成功後:
1. ユーザー情報とIDトークンが表示される
2. 「📋 トークンをコピー」ボタンをクリック

### ステップ4: Swagger UIでテスト

1. 「🔗 Swagger UIを開く」ボタンをクリック
2. Swagger UIで「Authorize」ボタンをクリック
3. コピーしたトークンを貼り付け
4. APIをテスト!

## トークンの保存

トークンは自動的に `localStorage` に保存されます:
- キー: `cognitoIdToken`
- 有効期限が切れたトークンは自動的に削除されます

## エラーハンドリング

### よくあるエラー

#### ❌ ユーザー名またはパスワードが間違っています
- 入力したメールアドレスまたはパスワードを確認
- Cognitoコンソールでユーザーが存在するか確認

#### ❌ ユーザーが確認されていません
- Cognitoでユーザーの確認が必要
- 確認メールのリンクをクリック、またはAWS CLIで確認:
  ```bash
  aws cognito-idp admin-confirm-sign-up \
    --user-pool-id ap-northeast-1_aAPBRNL7D \
    --username user@example.com
  ```

#### ❌ ユーザーが存在しません
- Cognitoでユーザーを作成する必要があります

## セキュリティ

### 実装されているセキュリティ機能

✅ **HTTPS推奨**
- 本番環境では必ずHTTPSを使用

✅ **トークンの自動有効期限チェック**
- 保存されたトークンの有効期限を自動確認
- 期限切れトークンは自動削除

✅ **パスワードのマスキング**
- パスワードフィールドは `type="password"` で保護

⚠️ **注意事項**
- トークンはlocalStorageに保存されます
- XSS攻撃からトークンを保護するため、CSPを設定してください
- 本番環境では適切なセキュリティヘッダーを設定してください

## カスタマイズ

### Cognito設定の変更

`auth.html` の以下の部分を編集:

```javascript
const poolData = {
  UserPoolId: 'ap-northeast-1_aAPBRNL7D',  // あなたのUser Pool ID
  ClientId: '23jacbr6nk4baiftjueddmr4kb'    // あなたのClient ID
};
```

### スタイルのカスタマイズ

`<style>` タグ内のCSSを編集してデザインをカスタマイズできます。

## トラブルシューティング

### トークンが取得できない

1. ブラウザのコンソールを開く (F12)
2. エラーメッセージを確認
3. Cognito設定を確認:
   - User Pool IDが正しいか
   - Client IDが正しいか
   - USER_PASSWORD_AUTHが有効か

### コピーボタンが動作しない

- ブラウザがクリップボードAPIをサポートしているか確認
- HTTPSでアクセスしているか確認（一部ブラウザはHTTPSが必要）

## 技術スタック

- **HTML5/CSS3**: レスポンシブUI
- **Vanilla JavaScript**: フレームワーク不要
- **amazon-cognito-identity-js**: Cognito SDK
- **CDN**: amazon-cognito-identity-js@6.3.6

## ライセンス

このファイルはMoodle BFFプロジェクトの一部です。
