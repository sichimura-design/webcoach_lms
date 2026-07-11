# デプロイメントガイド

## 開発環境 vs 本番環境の設定

このプロジェクトでは、環境ごとに異なる設定を適用します。

### 📁 ファイル構成

```
moodle-docker/
├── docker-compose.yml           # 本番環境用（ポート公開なし）
├── docker-compose.override.yml  # 開発/テスト環境用（ポート公開あり）
└── .gitignore                   # override.ymlを除外するか検討
```

---

## 🔧 開発/テスト環境

### docker-compose.override.yml の動作

docker-composeは自動的に以下の順序で設定を読み込みます：

1. `docker-compose.yml` （ベース設定）
2. `docker-compose.override.yml` （オーバーライド設定）

**開発環境で起動:**
```bash
cd /home/ec2-user/moodle-docker

# docker-compose.override.yml が自動的に適用される
docker-compose up -d

# BFFサーバーにアクセス可能
curl http://localhost:3001/health

# テスト実行
cd api-server
pytest tests/test_bff_schemathesis.py -v
```

---

## 🚀 本番環境へのデプロイ

### 方法1: override.yml を含めない（推奨）

本番環境には `docker-compose.override.yml` をデプロイしません。

**本番サーバーでの起動:**
```bash
# override.yml がない場合、docker-compose.yml のみが使用される
docker-compose up -d

# ポート3001は公開されない（セキュア）
# nginxを経由したアクセスのみ可能
```

**デプロイスクリプト例:**
```bash
#!/bin/bash
# deploy.sh

# 本番サーバーに必要なファイルのみをコピー
rsync -av \
  --exclude 'docker-compose.override.yml' \
  --exclude 'mysql-data' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  ./ production-server:/path/to/moodle-docker/

# 本番環境で起動
ssh production-server "cd /path/to/moodle-docker && docker-compose up -d"
```

### 方法2: 明示的に無効化

デプロイ時に override.yml を無視するように指定：

```bash
# override.yml を無視して起動
docker-compose -f docker-compose.yml up -d
```

---

## 🔐 セキュリティ設定

### .gitignore の設定

開発環境固有の設定をバージョン管理から除外する場合：

```gitignore
# .gitignore

# 開発環境専用設定（オプション）
docker-compose.override.yml

# 環境変数
.env.local
.env.development

# データファイル
mysql-data/
moodle-data/
chromadb/
```

**注意:** チーム開発の場合は `docker-compose.override.yml.example` を用意し、
各開発者がコピーして使用する方法もあります。

---

## 🧪 テスト環境での設定

### CI/CD パイプラインでのテスト

GitHub Actions や Jenkins などでテストを実行する場合：

```yaml
# .github/workflows/test.yml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Start services
        run: |
          cd moodle-docker
          # テスト用の override.yml を使用
          docker-compose up -d

      - name: Wait for services
        run: |
          sleep 30
          curl --retry 10 --retry-delay 5 http://localhost:3001/health

      - name: Run tests
        run: |
          cd moodle-docker/api-server
          pip install -r requirements.txt
          pytest tests/test_bff_schemathesis.py -v

      - name: Cleanup
        run: docker-compose down
```

---

## 🌍 環境変数の管理

本番環境とテスト環境で異なる環境変数を使用：

### 開発環境: .env.development
```bash
NODE_ENV=development
ENABLE_DOCS=true
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
SESSION_SECRET=dev-secret-change-me
```

### 本番環境: .env.production
```bash
NODE_ENV=production
ENABLE_DOCS=false
ALLOWED_ORIGINS=https://yourdomain.com
SESSION_SECRET=your-secure-random-secret-here
```

**使用方法:**
```bash
# 開発環境
docker-compose --env-file .env.development up -d

# 本番環境
docker-compose --env-file .env.production up -d
```

---

## 📋 デプロイチェックリスト

本番環境にデプロイする前に確認：

- [ ] `docker-compose.override.yml` が本番環境に含まれていないか確認
- [ ] 環境変数（.env）が本番用の値になっているか確認
- [ ] SESSION_SECRET が強力なランダム値か確認
- [ ] ENABLE_DOCS が false になっているか確認
- [ ] ALLOWED_ORIGINS が本番ドメインのみか確認
- [ ] データベースのパスワードが安全か確認
- [ ] SSL証明書が設定されているか確認（nginx）
- [ ] ファイアウォールで不要なポートが閉じられているか確認
- [ ] バックアップ体制が整っているか確認

---

## 🔍 本番環境での確認

本番環境でポートが公開されていないことを確認：

```bash
# ポートリスニング状態を確認
netstat -tlnp | grep 3001
# 結果が空 = ポート3001は外部公開されていない ✅

# nginxのみが80/443をリスニング
netstat -tlnp | grep -E '80|443'
# nginxのみが表示される ✅

# Dockerコンテナのポートマッピング確認
docker ps
# bff-serverのPORTSカラムに "3001/tcp" のみ（ホストポートなし）✅
```

---

## 🆘 トラブルシューティング

### 本番環境でもポートが公開されてしまう

**原因:** `docker-compose.override.yml` が本番環境に存在している

**解決策:**
```bash
# override.ymlを削除
rm docker-compose.override.yml

# 再起動
docker-compose down
docker-compose -f docker-compose.yml up -d
```

### テスト環境でポートにアクセスできない

**原因:** `docker-compose.override.yml` が存在しない

**解決策:**
```bash
# override.ymlを作成（このガイドの最初のセクション参照）
# または、一時的にポートを公開
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

---

## 📚 参考リンク

- [Docker Compose Override](https://docs.docker.com/compose/extends/)
- [Docker Compose Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
