#!/bin/bash

# BFF Server Deployment Script (Docker不使用)
# EC2サーバー: 15.168.134.84

set -e

echo "========================================"
echo "BFF Server Deployment (No Docker)"
echo "========================================"

# カレントディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BFF_DIR="$SCRIPT_DIR/bff-server"

cd "$BFF_DIR"

# 環境変数ファイルの作成
echo "Creating .env file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env file created from .env.example"
else
    echo ".env file already exists"
fi

# Node.jsバージョン確認
echo ""
echo "Checking Node.js version..."
node --version || {
    echo "Error: Node.js is not installed"
    echo "Please install Node.js 18 or higher"
    exit 1
}

# 依存関係のインストール
echo ""
echo "Installing dependencies..."
npm install --production

# 既存のプロセスを停止
echo ""
echo "Stopping existing BFF server process..."
pkill -f "node.*index.js" || echo "No existing process found"

# PM2を使用する場合（推奨）
if command -v pm2 &> /dev/null; then
    echo ""
    echo "Using PM2 to manage BFF server..."

    # PM2でプロセス削除
    pm2 delete moodle-bff 2>/dev/null || echo "No existing PM2 process found"

    # PM2で起動
    pm2 start index.js --name moodle-bff --env production
    pm2 save

    echo ""
    echo "BFF server started with PM2"
    pm2 status
else
    # PM2がない場合は直接起動（バックグラウンド）
    echo ""
    echo "Starting BFF server in background..."
    NODE_ENV=production nohup node index.js > /tmp/bff-server.log 2>&1 &

    echo "BFF server started (PID: $!)"
    echo "Logs: /tmp/bff-server.log"
fi

echo ""
echo "========================================"
echo "BFF Server Deployment Complete!"
echo "========================================"
echo "Server URL: http://15.168.134.84:3001"
echo "Health Check: http://15.168.134.84:3001/health"
echo ""
echo "To check logs:"
if command -v pm2 &> /dev/null; then
    echo "  pm2 logs moodle-bff"
else
    echo "  tail -f /tmp/bff-server.log"
fi
echo ""
