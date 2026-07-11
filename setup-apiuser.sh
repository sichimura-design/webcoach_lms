#!/bin/bash

# apiuser セットアップスクリプト
# BFF用のMoodleサービスアカウントとWebサービスを設定

set -e

MYSQL_ROOT_PASSWORD="rootpassword123"
MYSQL_CONTAINER="moodle-mysql"
DB_NAME="bitnami_moodle"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================="
echo "Moodle APIユーザー (apiuser) セットアップ"
echo "=========================================="
echo ""

# MySQLコンテナが起動しているか確認
if ! sudo docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo "❌ エラー: MySQLコンテナ '$MYSQL_CONTAINER' が起動していません"
    echo ""
    echo "まず以下を実行してください:"
    echo "  ./start-moodle.sh"
    exit 1
fi

echo "[1/3] apiuserとwebserviceuserロールを設定中..."
sudo docker exec -i "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" < "$SCRIPT_DIR/setup-apiuser.sql"

echo ""
echo "[2/3] 外部サービス (moodle-api-service) を設定中..."
if [ -f "$SCRIPT_DIR/bff-server/init-service-db.sql" ]; then
    sudo docker exec -i "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" < "$SCRIPT_DIR/bff-server/init-service-db.sql"
    echo "  ✓ 外部サービスの設定が完了しました"
else
    echo "  ⚠ init-service-db.sql が見つかりません。スキップします。"
fi

echo ""
echo "[3/3] トークンを生成中..."
# Moodle CLIでトークンを生成
# Note: BitnamiのMoodleイメージではmoosh/moodle-cliが利用できない場合があります
# その場合は手動でトークンを生成する必要があります

# トークンが既に存在するか確認
EXISTING_TOKEN=$(sudo docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -sN "$DB_NAME" -e "
SELECT t.token
FROM mdl_external_tokens t
JOIN mdl_user u ON t.userid = u.id
JOIN mdl_external_services s ON t.externalserviceid = s.id
WHERE u.username = 'apiuser'
AND s.shortname = 'moodle-api-service'
LIMIT 1;
" 2>/dev/null | grep -v "Using a password")

if [ -n "$EXISTING_TOKEN" ]; then
    echo "  ✓ トークンが既に存在します: $EXISTING_TOKEN"
else
    echo "  ℹ トークンが見つかりません"
    echo ""
    echo "  以下の手順で手動でトークンを生成してください:"
    echo "  1. Moodleに管理者でログイン"
    echo "  2. サイト管理 > サーバ > Webサービス > トークンを管理する"
    echo "  3. 新しいトークンを作成:"
    echo "     - ユーザー: apiuser"
    echo "     - サービス: moodle-api-service"
    echo "  4. 生成されたトークンを .env ファイルに設定"
    echo ""
fi

echo ""
echo "=========================================="
echo "✅ セットアップ完了！"
echo "=========================================="
echo ""
echo "次の手順:"
echo "1. 上記でトークンを生成（まだの場合）"
echo "2. .env ファイルを確認/更新:"
echo "   MOODLE_SERVICE_USERNAME=apiuser"
echo "   MOODLE_SERVICE_PASSWORD=Admin123!"
echo "   MOODLE_SERVICE_NAME=moodle-api-service"
echo ""
echo "3. BFFを再起動:"
echo "   sudo docker-compose restart bff-server"
echo ""
echo "APIのテスト（トークンを取得後）:"
echo "  TOKEN='your_token_here'"
echo "  curl -k -X POST https://YOUR_IP/webservice/rest/server.php \\"
echo "    -d \"wstoken=\$TOKEN\" \\"
echo "    -d \"wsfunction=core_webservice_get_site_info\" \\"
echo "    -d \"moodlewsrestformat=json\""
echo ""
