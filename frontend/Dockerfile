# Frontend Dockerfile for Moodle SPA
FROM node:18-alpine

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production && npm cache clean --force

# アプリケーションコードをコピー
COPY . .

# ビルド（本番環境用）
# 開発環境の場合はコメントアウトして、startコマンドを使用
# RUN npm run build

# 開発サーバーを起動（ポート3000）
EXPOSE 3000

# 開発モード
CMD ["npm", "start"]

# 本番モード（ビルド済みの場合）
# CMD ["npx", "serve", "-s", "build", "-l", "3000"]
