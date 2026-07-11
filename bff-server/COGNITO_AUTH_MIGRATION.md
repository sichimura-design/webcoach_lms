# Cognito JWT認証への移行ガイド

## 概要

BFFサーバーは、従来のセッション認証からCognito JWT認証に移行しました。

## 主な変更点

### 1. 認証方式の変更

**従来**: Cookie-based Session認証
- `req.session.userId` でユーザーを識別
- BFFサーバーがセッションを管理

**現在**: JWT Token認証 (Cognito)
- `Authorization: Bearer <idToken>` ヘッダーでトークンを送信
- Cognitoが発行したJWTトークンを検証
- ステートレスな認証

### 2. パッケージの追加

```bash
npm install aws-jwt-verify
```

### 3. 環境変数の追加

`.env`ファイルに以下を追加:

```env
COGNITO_USER_POOL_ID=ap-northeast-1_aAPBRNL7D
COGNITO_CLIENT_ID=23jacbr6nk4baiftjueddmr4kb
COGNITO_REGION=ap-northeast-1
```

### 4. ミドルウェアの変更

#### requireAuth

**変更前**:
```javascript
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
```

**変更後**:
```javascript
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = await verifier.verify(token);

    req.user = {
      sub: payload.sub,
      email: payload.email,
      username: payload['cognito:username'],
    };

    // MoodleユーザーをemailでLookup
    const moodleUsers = await callMoodleAPI('core_user_get_users_by_field', {
      field: 'email',
      'values[0]': payload.email
    });

    if (moodleUsers && moodleUsers.length > 0) {
      req.user.moodleUserId = moodleUsers[0].id;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
};
```

#### requireOwnership

**変更前**: `req.session.userId` でチェック

**変更後**: `req.user.moodleUserId` でチェック

### 5. CORS設定の変更

**変更前**:
```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,  // Cookie使用のため必要
  optionsSuccessStatus: 200
};
```

**変更後**:
```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  // credentials: true は不要（Cookieを使用しない）
  optionsSuccessStatus: 200
};
```

### 6. 非推奨エンドポイント

以下のエンドポイントは、Cognito JWT認証では使用しません（後方互換性のために残存）:

- `POST /api/login` - フロントエンドがCognito直接認証を使用
- `POST /api/logout` - フロントエンドがCognito signOutを使用

## フロントエンドの対応

### 1. Cognito認証

```javascript
import { CognitoUserPool, AuthenticationDetails, CognitoUser } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'ap-northeast-1_aAPBRNL7D',
  ClientId: '23jacbr6nk4baiftjueddmr4kb'
};

const userPool = new CognitoUserPool(poolData);

// ログイン
const authenticationData = {
  Username: username,
  Password: password,
};

const authenticationDetails = new AuthenticationDetails(authenticationData);

const userData = {
  Username: username,
  Pool: userPool
};

const cognitoUser = new CognitoUser(userData);

cognitoUser.authenticateUser(authenticationDetails, {
  onSuccess: (result) => {
    const idToken = result.getIdToken().getJwtToken();
    // idTokenを保存（localStorageまたはstate）
  },
  onFailure: (err) => {
    console.error(err);
  }
});
```

### 2. API呼び出し

```javascript
const idToken = localStorage.getItem('idToken'); // または state から取得

fetch('https://api.example.com/api/moodle/courses/123', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

### 3. ログアウト

```javascript
const cognitoUser = userPool.getCurrentUser();
if (cognitoUser) {
  cognitoUser.signOut();
  localStorage.removeItem('idToken');
}
```

## ユーザーマッピング

CognitoユーザーとMoodleユーザーは、**emailアドレス**で紐付けられます。

1. Cognito IDトークンから`email`を取得
2. BFFが`core_user_get_users_by_field`を使用してMoodleユーザーを検索
3. `req.user.moodleUserId`にMoodleユーザーIDを設定
4. `requireOwnership`ミドルウェアで認可チェック

## トラブルシューティング

### トークン検証エラー

```
Token verification failed: Token expired
```

**対処**: フロントエンドでトークンをリフレッシュしてください。

### Moodleユーザーが見つからない

```
No Moodle user found for email: xxx@example.com
```

**対処**: Cognitoのemailと一致するMoodleユーザーが存在するか確認してください。

## 移行チェックリスト

- [ ] `aws-jwt-verify`パッケージをインストール
- [ ] 環境変数を設定
- [ ] BFFサーバーを再起動
- [ ] フロントエンドでCognito認証を実装
- [ ] APIリクエストに`Authorization`ヘッダーを追加
- [ ] セッション関連のコードを削除（フロントエンド）
- [ ] テスト実施

## セキュリティ上の注意

1. **トークンの保管**: localStorage よりも sessionStorage の使用を推奨
2. **HTTPS必須**: 本番環境では必ずHTTPSを使用
3. **トークンの有効期限**: IDトークンは1時間で期限切れ（リフレッシュトークンで更新）
4. **XSS対策**: トークンをJavaScriptからアクセス可能な場所に保存する場合、XSS対策を徹底

## 参考資料

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [aws-jwt-verify](https://github.com/awslabs/aws-jwt-verify)
