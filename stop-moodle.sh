#!/bin/bash

# Moodle + MySQL Docker停止スクリプト

MYSQL_CONTAINER="moodle-mysql"
MOODLE_CONTAINER="moodle-app"

echo "=========================================="
echo "Moodle + MySQL Docker環境を停止します"
echo "=========================================="
echo ""

# Moodleコンテナを停止
if sudo docker ps --format '{{.Names}}' | grep -q "^${MOODLE_CONTAINER}$"; then
    echo "Moodleコンテナを停止中..."
    sudo docker stop "$MOODLE_CONTAINER"
    echo "  ✓ Moodleコンテナを停止しました"
else
    echo "  - Moodleコンテナは実行されていません"
fi

# MySQLコンテナを停止
if sudo docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo "MySQLコンテナを停止中..."
    sudo docker stop "$MYSQL_CONTAINER"
    echo "  ✓ MySQLコンテナを停止しました"
else
    echo "  - MySQLコンテナは実行されていません"
fi

echo ""
echo "✓ 停止完了"
echo ""
echo "コンテナを再起動するには："
echo "  ./start-moodle.sh"
echo ""
echo "コンテナを完全に削除するには："
echo "  sudo docker rm $MOODLE_CONTAINER $MYSQL_CONTAINER"
echo ""
