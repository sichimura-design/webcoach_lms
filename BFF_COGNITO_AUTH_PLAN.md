# BFF Cognito認証対応 修正方針

## 概要
フロントエンドがCognito直接認証に移行したため、BFFはセッション認証からJWTトークン検証方式に変更する。
CognitoのJWTにはMoodleのuserIdが含まれないため、emailベースでMoodleユーザーを検索しキャッシュする方式を採用する。

## 必要なパッケージ
```bash
npm install aws-jwt-verify
```

## 変更箇所

### 1. requireAuthミドルウェアの変更
**現在**: `req.session.userId` をチェック
**変更後**: `Authorization: Bearer <idToken>` ヘッダーからJWTを検証 → emailでMoodleユーザーを解決

```javascript
const { CognitoJwtVerifier } = require('aws-jwt-verify');

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'ap-northeast-1_aAPBRNL7D';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '23jacbr6nk4baiftjueddmr4kb';

const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: COGNITO_CLIENT_ID,
});

// email → Moodle userId のキャッシュ
const moodleUserCache = new Map();

const resolveMoodleUserId = async (email) => {
  if (moodleUserCache.has(email)) {
    return moodleUserCache.get(email);
  }

  const result = await callMoodleAPI('core_user_get_users', {
    criteria: [{ key: 'email', value: email }]
  });

  if (result.users && result.users.length > 0) {
    const userId = result.users[0].id;
    moodleUserCache.set(email, userId);
    return userId;
  }
  return null;
};

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = await verifier.verify(token);

    const moodleUserId = await resolveMoodleUserId(payload.email);
    if (!moodleUserId) {
      return res.status(403).json({ error: 'Moodleユーザーが見つかりません' });
    }

    req.user = {
      sub: payload.sub,
      email: payload.email,
      username: payload['cognito:username'],
      userId: moodleUserId,  // 既存コードの req.session.userId と同じ値
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
};
```

### 2. 既存コードの置換
`req.session.userId` → `req.user.userId` に一括置換する。
`req.session.username` → `req.user.username` に一括置換する。

### 3. /api/login エンドポイント
- フロントエンドがCognito直接認証するため不要
- 削除するか、後方互換のために残してもよい

### 4. /api/logout エンドポイント
- フロントエンド側でCognito signOutするのみ
- BFF側はステートレスになるため不要

### 5. セッション管理
- express-session は不要になる
- Moodleサービスアカウントトークンのキャッシュには引き続き使えるのでそのまま残してもよい

### 6. CORS設定
- `credentials: true` は不要（Cookieを使わないため）
- `Authorization` ヘッダーを許可する設定を確認

## 環境変数の追加
```
COGNITO_USER_POOL_ID=ap-northeast-1_aAPBRNL7D
COGNITO_CLIENT_ID=23jacbr6nk4baiftjueddmr4kb
```

## ユーザーID解決フロー
```
SPA → BFF (Authorization: Bearer <idToken>)
        ↓ JWT検証 → email取得
        ↓ キャッシュ確認
        ├─ キャッシュあり → userId取得（API呼び出しなし）
        └─ キャッシュなし → Moodle API: core_user_get_users(email) → userId取得・キャッシュ
        ↓ req.user.userId にセット
        ↓ 既存のAPIハンドラがそのまま動作
```

## 備考
- CognitoとMoodleのユーザーは同じemailで紐付く前提
- Cognitoユーザー作成 → Moodle OAuth2初回ログインで自動作成されるため、タイミングによってはMoodleユーザーがまだ存在しない可能性がある（403を返す）
- キャッシュはプロセス再起動でクリアされる（問題なし）
