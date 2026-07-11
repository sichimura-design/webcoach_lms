# Cognito JWT認証でAPIをテストする方法

## 方法1: AWS CLIでトークンを取得

### 1. ユーザー認証してIDトークンを取得

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 23jacbr6nk4baiftjueddmr4kb \
  --auth-parameters USERNAME=your-username,PASSWORD=your-password \
  --region ap-northeast-1
```

レスポンス例:
```json
{
  "AuthenticationResult": {
    "AccessToken": "eyJraWQiOiI...",
    "IdToken": "eyJraWQiOiI...",
    "RefreshToken": "eyJjdHkiOiI...",
    "ExpiresIn": 3600,
    "TokenType": "Bearer"
  }
}
```

### 2. IDトークンでAPIをテスト

```bash
ID_TOKEN="eyJraWQiOiI..."  # 上記で取得したIdToken

curl -X GET "http://localhost:3001/api/webcoach/profile/2" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 方法2: テスト用スクリプト（Node.js）

### インストール

```bash
npm install amazon-cognito-identity-js
```

### テストスクリプト作成

`test-auth.js`:

```javascript
const {
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUser,
} = require('amazon-cognito-identity-js');

const poolData = {
  UserPoolId: 'ap-northeast-1_aAPBRNL7D',
  ClientId: '23jacbr6nk4baiftjueddmr4kb',
};

const userPool = new CognitoUserPool(poolData);

function login(username, password) {
  return new Promise((resolve, reject) => {
    const authenticationData = {
      Username: username,
      Password: password,
    };

    const authenticationDetails = new AuthenticationDetails(authenticationData);

    const userData = {
      Username: username,
      Pool: userPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        const idToken = result.getIdToken().getJwtToken();
        const accessToken = result.getAccessToken().getJwtToken();
        const refreshToken = result.getRefreshToken().getToken();

        console.log('✅ Login successful!');
        console.log('\n📋 ID Token (use this for API calls):');
        console.log(idToken);
        console.log('\n📋 Access Token:');
        console.log(accessToken);
        console.log('\n📋 Refresh Token:');
        console.log(refreshToken);

        resolve({
          idToken,
          accessToken,
          refreshToken,
        });
      },
      onFailure: (err) => {
        console.error('❌ Login failed:', err.message);
        reject(err);
      },
    });
  });
}

// 使用例
const username = process.argv[2] || 'testuser';
const password = process.argv[3] || 'TestPassword123!';

login(username, password)
  .then((tokens) => {
    console.log('\n🧪 Test API call example:');
    console.log(`curl -H "Authorization: Bearer ${tokens.idToken}" http://localhost:3001/api/moodle/courses`);
  })
  .catch((err) => {
    process.exit(1);
  });
```

### 実行

```bash
node test-auth.js your-username your-password
```

---

## 方法3: Postmanでテスト

### 1. 新しいリクエストを作成

### 2. Authorizationタブで設定

- Type: `Bearer Token`
- Token: `<your-id-token>`（AWS CLIまたはスクリプトで取得）

### 3. リクエスト送信

```
GET http://localhost:3001/api/webcoach/profile/2
Authorization: Bearer eyJraWQiOiI...
```

---

## 方法4: curlスクリプト（簡易版）

### get-token.shを作成

```bash
#!/bin/bash

USERNAME=$1
PASSWORD=$2

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: ./get-token.sh <username> <password>"
  exit 1
fi

echo "🔐 Authenticating with Cognito..."

RESPONSE=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 23jacbr6nk4baiftjueddmr4kb \
  --auth-parameters USERNAME=$USERNAME,PASSWORD=$PASSWORD \
  --region ap-northeast-1 \
  --output json 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Authentication failed:"
  echo "$RESPONSE"
  exit 1
fi

ID_TOKEN=$(echo $RESPONSE | jq -r '.AuthenticationResult.IdToken')

if [ "$ID_TOKEN" = "null" ]; then
  echo "❌ Failed to extract ID token"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ Authentication successful!"
echo ""
echo "📋 ID Token:"
echo "$ID_TOKEN"
echo ""
echo "💾 Saving to .id-token file..."
echo "$ID_TOKEN" > .id-token

echo ""
echo "🧪 Test API call:"
echo "curl -H \"Authorization: Bearer \$(cat .id-token)\" http://localhost:3001/api/moodle/courses"
```

### 実行

```bash
chmod +x get-token.sh
./get-token.sh your-username your-password

# トークンを使ってAPIテスト
curl -H "Authorization: Bearer $(cat .id-token)" \
  http://localhost:3001/api/webcoach/profile/2
```

---

## 方法5: 開発用バイパス（推奨しない）

テスト環境でのみ使用する場合、一時的にJWT検証をスキップするミドルウェアを作成できます。

**⚠️ 本番環境では絶対に使用しないでください**

```javascript
// index.js に追加（開発環境のみ）
const requireAuth = async (req, res, next) => {
  // 開発環境でテストヘッダーがある場合はバイパス
  if (NODE_ENV === 'development' && req.headers['x-test-user-email']) {
    console.log('⚠️ DEV MODE: Bypassing JWT verification');

    const email = req.headers['x-test-user-email'];

    req.user = {
      sub: 'test-user',
      email: email,
      username: email.split('@')[0],
    };

    // Moodleユーザーをlookup
    try {
      const moodleUsers = await callMoodleAPI('core_user_get_users_by_field', {
        field: 'email',
        'values[0]': email
      });

      if (moodleUsers && moodleUsers.length > 0) {
        req.user.moodleUserId = moodleUsers[0].id;
      }
    } catch (error) {
      console.error('Failed to lookup Moodle user:', error.message);
    }

    return next();
  }

  // 通常のJWT検証処理
  // ...
};
```

使用方法:
```bash
curl -H "X-Test-User-Email: testuser@example.com" \
  http://localhost:3001/api/webcoach/profile/2
```

---

## トラブルシューティング

### エラー: "USER_PASSWORD_AUTH flow not enabled"

Cognitoコンソールで`USER_PASSWORD_AUTH`を有効化する必要があります:

1. Cognito User Poolsコンソールを開く
2. App clientsタブを選択
3. `23jacbr6nk4baiftjueddmr4kb`を編集
4. "Enable username password auth for admin APIs for authentication (ALLOW_USER_PASSWORD_AUTH)" をチェック

### エラー: "Token expired"

トークンは1時間で期限切れになります。再度ログインしてトークンを取得してください。

### エラー: "No Moodle user found"

CognitoのemailとMoodleのemailが一致しているか確認してください。

---

## 推奨フロー

1. **開発時**: 方法4（curlスクリプト）が最も簡単
2. **統合テスト**: 方法2（Node.jsスクリプト）でトークンを自動取得
3. **手動テスト**: 方法3（Postman）でGUIベースのテスト
4. **CI/CD**: AWS CLIを使用して環境変数にトークンを保存

---

## セキュリティ上の注意

- トークンをGitにコミットしない
- `.id-token`を`.gitignore`に追加
- 本番環境のトークンは厳重に管理
- テスト用ユーザーは本番データにアクセスできないようにする
