FROM nginx:alpine

# Nginxの設定ファイルをテンプレートとしてコピー。BFF_HOST/MOODLE_HOSTは
# docker-entrypoint-envsubst.sh がコンテナ起動時に実値へ置換する
# (docker-composeとECS host networkでバックエンドの参照方法が異なるため)。
COPY conf/nginx.conf /etc/nginx/nginx.conf.template

# docker-compose(Docker embedded DNSでサービス名が解決できる)向けデフォルト。
# ECS(host networkモード)ではcdk-prod側でlocalhost:<port>を明示的に上書きする。
ENV BFF_HOST=moodle-bff:3001
ENV MOODLE_HOST=moodle-app:8080

COPY docker-entrypoint-envsubst.sh /docker-entrypoint.d/00-envsubst-nginx-conf.sh
RUN chmod +x /docker-entrypoint.d/00-envsubst-nginx-conf.sh

# SSL証明書をコピー（存在する場合）
COPY ssl/ /etc/nginx/ssl/

# ヘルスチェック用のエンドポイント
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Nginxをフォアグラウンドで実行
CMD ["nginx", "-g", "daemon off;"]
