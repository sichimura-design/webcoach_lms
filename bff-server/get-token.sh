#!/bin/bash

# Cognito IDトークン取得スクリプト

USERNAME=$1
PASSWORD=$2
CLIENT_ID=${3:-"23jacbr6nk4baiftjueddmr4kb"}
REGION=${4:-"ap-northeast-1"}

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "使用方法: ./get-token.sh <username> <password> [client-id] [region]"
  echo ""
  echo "例:"
  echo "  ./get-token.sh testuser@example.com MyPassword123!"
  echo ""
  exit 1
fi

echo "🔐 Cognitoで認証中..."
echo "   Username: $USERNAME"
echo "   Client ID: $CLIENT_ID"
echo "   Region: $REGION"
echo ""

RESPONSE=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --region "$REGION" \
  --output json 2>&1)

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ 認証に失敗しました:"
  echo "$RESPONSE"
  echo ""
  echo "💡 よくあるエラー:"
  echo "   - USER_PASSWORD_AUTH が有効化されていない"
  echo "   - ユーザー名またはパスワードが間違っている"
  echo "   - ユーザーが確認されていない"
  exit 1
fi

ID_TOKEN=$(echo "$RESPONSE" | jq -r '.AuthenticationResult.IdToken')
ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.AuthenticationResult.AccessToken')
REFRESH_TOKEN=$(echo "$RESPONSE" | jq -r '.AuthenticationResult.RefreshToken')

if [ "$ID_TOKEN" = "null" ] || [ -z "$ID_TOKEN" ]; then
  echo "❌ IDトークンの取得に失敗しました"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ 認証成功!"
echo ""
echo "📋 ID Token (API呼び出しに使用):"
echo "$ID_TOKEN"
echo ""
echo "💾 トークンを .id-token ファイルに保存しました"
echo "$ID_TOKEN" > .id-token
echo ""

# トークンの情報を表示
echo "🔍 トークン情報:"
PAYLOAD=$(echo "$ID_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null || echo "$ID_TOKEN" | cut -d. -f2 | base64 -D 2>/dev/null)
if [ -n "$PAYLOAD" ]; then
  echo "$PAYLOAD" | jq . 2>/dev/null || echo "$PAYLOAD"
fi

echo ""
echo "🧪 APIテスト例:"
echo ""
echo "# ヘルスチェック"
echo "curl http://localhost:3001/health"
echo ""
echo "# 認証が必要なエンドポイント"
echo "curl -H \"Authorization: Bearer \$(cat .id-token)\" \\"
echo "     http://localhost:3001/api/moodle/courses"
echo ""
echo "# プロフィール取得（useridは適宜変更）"
echo "curl -H \"Authorization: Bearer \$(cat .id-token)\" \\"
echo "     http://localhost:3001/api/webcoach/profile/2"
echo ""
