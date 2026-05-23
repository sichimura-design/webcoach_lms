/**
 * Cognito認証テストスクリプト
 *
 * 使用方法:
 *   node test-auth.js <username> <password>
 *
 * 例:
 *   node test-auth.js testuser@example.com MyPassword123!
 */

const {
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUser,
} = require('amazon-cognito-identity-js');
const axios = require('axios');

const poolData = {
  UserPoolId: process.env.COGNITO_USER_POOL_ID || 'ap-northeast-1_aAPBRNL7D',
  ClientId: process.env.COGNITO_CLIENT_ID || '23jacbr6nk4baiftjueddmr4kb',
};

const BFF_URL = process.env.BFF_URL || 'http://localhost:3001';

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

    console.log('🔐 Cognitoで認証中...');
    console.log(`   Username: ${username}`);
    console.log(`   User Pool: ${poolData.UserPoolId}`);
    console.log(`   Client ID: ${poolData.ClientId}`);
    console.log('');

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        const idToken = result.getIdToken().getJwtToken();
        const accessToken = result.getAccessToken().getJwtToken();
        const refreshToken = result.getRefreshToken().getToken();

        console.log('✅ ログイン成功!\n');

        // トークンペイロードをデコード
        const payload = JSON.parse(
          Buffer.from(idToken.split('.')[1], 'base64').toString()
        );

        console.log('📋 トークン情報:');
        console.log('   Email:', payload.email);
        console.log('   Cognito Username:', payload['cognito:username']);
        console.log('   Sub (Cognito User ID):', payload.sub);
        console.log('   Expires:', new Date(payload.exp * 1000).toLocaleString());
        console.log('');

        console.log('🔑 ID Token (API呼び出しに使用):');
        console.log(idToken);
        console.log('');

        resolve({
          idToken,
          accessToken,
          refreshToken,
          payload,
        });
      },
      onFailure: (err) => {
        console.error('❌ ログイン失敗:', err.message);
        console.error('');
        console.error('💡 よくあるエラー:');
        console.error('   - ユーザー名またはパスワードが間違っている');
        console.error('   - ユーザーが確認されていない');
        console.error('   - USER_PASSWORD_AUTH が有効化されていない');
        reject(err);
      },
    });
  });
}

async function testAPI(idToken) {
  console.log('🧪 API接続テスト中...\n');

  const tests = [
    {
      name: 'ヘルスチェック (認証不要)',
      url: `${BFF_URL}/health`,
      method: 'GET',
      needsAuth: false,
    },
    {
      name: 'コース一覧取得',
      url: `${BFF_URL}/api/moodle/courses`,
      method: 'GET',
      needsAuth: true,
    },
  ];

  for (const test of tests) {
    try {
      console.log(`📡 ${test.name}`);
      console.log(`   ${test.method} ${test.url}`);

      const config = {
        method: test.method,
        url: test.url,
        headers: {},
      };

      if (test.needsAuth) {
        config.headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await axios(config);

      console.log(`   ✅ 成功 (${response.status})`);

      if (response.data) {
        const preview = JSON.stringify(response.data).substring(0, 200);
        console.log(`   📄 レスポンス: ${preview}...`);
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ 失敗`);
      if (error.response) {
        console.log(`   ステータス: ${error.response.status}`);
        console.log(`   エラー: ${JSON.stringify(error.response.data)}`);
      } else {
        console.log(`   エラー: ${error.message}`);
      }
      console.log('');
    }
  }
}

// メイン処理
async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error('使用方法: node test-auth.js <username> <password>');
    console.error('');
    console.error('例:');
    console.error('  node test-auth.js testuser@example.com MyPassword123!');
    process.exit(1);
  }

  try {
    const tokens = await login(username, password);

    console.log('💡 curlでのテスト例:');
    console.log(`curl -H "Authorization: Bearer ${tokens.idToken}" \\`);
    console.log(`     ${BFF_URL}/api/moodle/courses`);
    console.log('');

    // API接続テスト
    await testAPI(tokens.idToken);

    console.log('✅ 全てのテストが完了しました');
  } catch (err) {
    process.exit(1);
  }
}

main();
