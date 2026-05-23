#!/bin/bash

# Frontend Deployment Script (Docker不使用)
# EC2サーバー: 15.168.134.84

set -e

echo "========================================"
echo "Frontend Deployment (No Docker)"
echo "========================================"

# カレントディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

cd "$FRONTEND_DIR"

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
npm install

# ビルド
echo ""
echo "Building React application..."
npm run build

# 既存のプロセスを停止
echo ""
echo "Stopping existing frontend server process..."
pkill -f "serve.*build" || echo "No existing process found"

# serveパッケージのインストール確認
if ! command -v serve &> /dev/null; then
    echo ""
    echo "Installing 'serve' globally..."
    npm install -g serve
fi

# PM2を使用する場合（推奨）
if command -v pm2 &> /dev/null; then
    echo ""
    echo "Using PM2 to manage frontend server..."

    # PM2でプロセス削除
    pm2 delete moodle-frontend 2>/dev/null || echo "No existing PM2 process found"

    # PM2で起動
    pm2 serve build 3000 --name moodle-frontend --spa
    pm2 save

    echo ""
    echo "Frontend server started with PM2"
    pm2 status
else
    # PM2がない場合は直接起動（バックグラウンド）
    echo ""
    echo "Starting frontend server in background..."
    nohup serve -s build -l 3000 > /tmp/frontend-server.log 2>&1 &

    echo "Frontend server started (PID: $!)"
    echo "Logs: /tmp/frontend-server.log"
fi

echo ""
echo "========================================"
echo "Frontend Deployment Complete!"
echo "========================================"
echo "Frontend URL: http://15.168.134.84:3000"
echo ""
echo "To check logs:"
if command -v pm2 &> /dev/null; then
    echo "  pm2 logs moodle-frontend"
else
    echo "  tail -f /tmp/frontend-server.log"
fi
echo ""
