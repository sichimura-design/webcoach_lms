#!/bin/bash

# Moodle + MySQL Docker起動スクリプト

set -e

# 設定
NETWORK_NAME="moodle-network"
MYSQL_CONTAINER="moodle-mysql"
MOODLE_CONTAINER="moodle-app"
MYSQL_ROOT_PASSWORD="rootpassword123"
MYSQL_DATABASE="moodle"
MYSQL_USER="moodleuser"
MYSQL_PASSWORD="moodlepass123"
WORK_DIR="/home/ec2-user/moodle-docker"

# 外部IPアドレスを自動取得（EC2の場合）
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)
if [ -n "$TOKEN" ]; then
    PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
else
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
fi

echo "=========================================="
echo "Moodle + MySQL Docker環境を起動します"
echo "=========================================="
echo ""
echo "検出された公開IPアドレス: $PUBLIC_IP"
echo ""

# 必要なディレクトリを作成
echo "[1/6] 必要なディレクトリを作成..."
mkdir -p "$WORK_DIR/mysql-data"
mkdir -p "$WORK_DIR/moodle-data"
mkdir -p "$WORK_DIR/moodle-html"

# Dockerネットワークを作成（既存の場合はスキップ）
echo "[2/6] Dockerネットワークを作成..."
if sudo docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "  ✓ ネットワーク '$NETWORK_NAME' は既に存在します"
else
    sudo docker network create "$NETWORK_NAME"
    echo "  ✓ ネットワーク '$NETWORK_NAME' を作成しました"
fi

# 既存のコンテナを停止・削除
echo "[3/6] 既存のコンテナをクリーンアップ..."
if sudo docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo "  - 既存のMySQLコンテナを削除..."
    sudo docker stop "$MYSQL_CONTAINER" 2>/dev/null || true
    sudo docker rm "$MYSQL_CONTAINER" 2>/dev/null || true
fi

if sudo docker ps -a --format '{{.Names}}' | grep -q "^${MOODLE_CONTAINER}$"; then
    echo "  - 既存のMoodleコンテナを削除..."
    sudo docker stop "$MOODLE_CONTAINER" 2>/dev/null || true
    sudo docker rm "$MOODLE_CONTAINER" 2>/dev/null || true
fi

# MySQLコンテナを起動
echo "[4/6] MySQLコンテナを起動..."
sudo docker run -d \
    --name "$MYSQL_CONTAINER" \
    --network "$NETWORK_NAME" \
    -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$MYSQL_DATABASE" \
    -e MYSQL_USER="$MYSQL_USER" \
    -e MYSQL_PASSWORD="$MYSQL_PASSWORD" \
    -v "$WORK_DIR/mysql-data:/var/lib/mysql" \
    mysql:8.0 \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci \
    --default-authentication-plugin=mysql_native_password \
    --max_allowed_packet=256M \
    --innodb_buffer_pool_size=512M

echo "  ✓ MySQLコンテナを起動しました"

# MySQLの起動を待つ
echo "[5/6] MySQLの起動を待っています..."
for i in {1..30}; do
    if sudo docker exec "$MYSQL_CONTAINER" mysqladmin ping -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" >/dev/null 2>&1; then
        echo "  ✓ MySQLが起動しました"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  ✗ MySQLの起動がタイムアウトしました"
        exit 1
    fi
    echo "  待機中... ($i/30)"
    sleep 2
done

# Moodleコンテナを起動
echo "[6/6] Moodleコンテナを起動..."
sudo docker run -d \
    --name "$MOODLE_CONTAINER" \
    --network "$NETWORK_NAME" \
    -p 0.0.0.0:80:8080 \
    -e MOODLE_DATABASE_TYPE="mysqli" \
    -e MOODLE_DATABASE_HOST="$MYSQL_CONTAINER" \
    -e MOODLE_DATABASE_PORT_NUMBER="3306" \
    -e MOODLE_DATABASE_NAME="$MOODLE_DATABASE" \
    -e MOODLE_DATABASE_USER="$MYSQL_USER" \
    -e MOODLE_DATABASE_PASSWORD="$MYSQL_PASSWORD" \
    -e MOODLE_USERNAME="admin" \
    -e MOODLE_PASSWORD="Admin123!" \
    -e MOODLE_EMAIL="admin@example.com" \
    -e MOODLE_SITE_NAME="My Moodle Site" \
    -e MOODLE_HOST="$PUBLIC_IP" \
    -e BITNAMI_DEBUG="true" \
    -v "$WORK_DIR/moodle-data:/bitnami/moodledata" \
    -v "$WORK_DIR/moodle-html:/bitnami/moodle" \
    public.ecr.aws/bitnami/moodle:4.3.6

echo "  ✓ Moodleコンテナを起動しました"

echo ""
echo "=========================================="
echo "✓ 起動完了！"
echo "=========================================="
echo ""
echo "Moodleにアクセス: http://$PUBLIC_IP"
echo ""
echo "初回セットアップには数分かかることがあります。"
echo "以下のコマンドでログを確認できます："
echo "  sudo docker logs -f $MOODLE_CONTAINER"
echo ""
echo "デフォルトログイン情報:"
echo "  ユーザー名: admin"
echo "  パスワード: Admin123!"
echo ""
echo "注意: ポート80がファイアウォール/セキュリティグループで"
echo "      開いていることを確認してください。"
echo ""
echo "コンテナを停止するには："
echo "  ./stop-moodle.sh"
echo ""
