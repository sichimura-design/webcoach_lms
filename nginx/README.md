# nginx

Moodle SPA のリバースプロキシ。docker-compose 構成でフロント側の入口となり、BFF と Moodle 本体へリクエストを振り分けます。

## 構成

```
nginx/
├── Dockerfile        # nginx:alpine ベース。conf と ssl をイメージに同梱
├── conf/nginx.conf   # 本体設定
└── ssl/              # server.crt / server.key（開発用の自己署名証明書）
```

## ルーティング（`conf/nginx.conf`）

| ポート | パス | 転送先 |
|---|---|---|
| 80 | `/health` | nginx 自身が `200 OK` を返す |
| 80 | 上記以外 | 443 へ 301 リダイレクト（OPTIONS は 204） |
| 443 | `/api/`, `/login`, `/user/info`, `/auth.html`, `/api-docs`, `/health` | BFF (`moodle-bff:3001`) |
| 443 | `/` | Moodle (`moodle-app:8080`) |

- upstream ブロックは DNS をキャッシュしてしまうため、`map` で変数化したホスト名 + Docker DNS の `resolver` で動的解決しています。コンテナ再作成で IP が変わっても nginx の再起動は不要です。
- BFF へのプロキシでは `Set-Cookie` と CORS 系ヘッダをそのまま通します（Moodle セッション認証のため）。

## 起動

リポジトリルートの `docker-compose.yml` から起動します（`nginx/conf/nginx.conf` と `nginx/ssl` を read-only でマウント）。

```bash
docker compose up -d nginx
docker compose exec nginx nginx -t        # 設定の構文チェック
docker compose exec nginx nginx -s reload # 設定の再読み込み
```

## 注意

- `ssl/` の証明書は開発用です。本番（prod）は ALB + CloudFront で TLS を終端するため、この nginx は使いません。
- 設定変更後は `nginx -t` で構文チェックしてから reload してください。
