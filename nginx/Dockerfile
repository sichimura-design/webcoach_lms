FROM nginx:alpine

# Nginxの設定ファイルをコピー
COPY conf/nginx.conf /etc/nginx/nginx.conf

# SSL証明書をコピー（存在する場合）
COPY ssl/ /etc/nginx/ssl/

# ヘルスチェック用のエンドポイント
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Nginxをフォアグラウンドで実行
CMD ["nginx", "-g", "daemon off;"]
