# Moodle 日本語設定ガイド

本ガイドでは、Moodle Dockerコンテナで日本語設定を適用する方法を説明します。

## 目次

1. [新規構築時の設定](#新規構築時の設定)
2. [既存環境への適用](#既存環境への適用)
3. [カスタムイメージの使用](#カスタムイメージの使用)
4. [トラブルシューティング](#トラブルシューティング)

---

## 新規構築時の設定

新しくMoodleを構築する場合、以下の設定で日本語がデフォルト言語として設定されます。

### 方法1: 環境変数の設定（推奨）

`.env`ファイルで言語を指定：

```bash
# .env
MOODLE_LANG=ja
```

`docker-compose.yml`の設定：

```yaml
services:
  moodle:
    environment:
      MOODLE_LANG: ${MOODLE_LANG:-ja}
```

**この設定により：**
- 初回インストール時のデフォルト言語が日本語になります
- システムの標準言語が日本語に設定されます
- ただし、adminユーザーの言語設定は別途必要な場合があります

### 新規構築の手順

```bash
# 1. 既存のデータを削除（注意：データが消えます）
sudo rm -rf moodle-data/* moodle-html/*
sudo docker volume rm moodle-mysql-data 2>/dev/null || true

# 2. コンテナの削除
sudo docker-compose down -v

# 3. コンテナの起動（日本語設定が自動適用されます）
sudo docker-compose up -d

# 4. 起動完了まで待機（2-3分程度）
sudo docker-compose logs -f moodle

# 5. 言語設定の確認と適用
./apply-japanese-lang.sh
```

---

## 既存環境への適用

既に稼働中のMoodleシステムに日本語設定を適用する方法です。

### 方法1: 自動設定スクリプトの使用（推奨）

既存環境でも簡単に日本語設定を適用できるスクリプトを用意しています：

```bash
# 日本語設定を適用
./apply-japanese-lang.sh
```

**このスクリプトは以下を実行します：**
1. adminユーザーの言語設定を日本語に変更
2. システムのデフォルト言語を日本語に設定
3. 既存データを保持したまま設定を変更

### 方法2: 手動でのSQL実行

```bash
# MySQLコンテナに接続
sudo docker exec -it moodle-mysql mysql -u moodleuser -pmoodlepass123 bitnami_moodle

# adminユーザーの言語を日本語に変更
UPDATE mdl_user SET lang='ja' WHERE username='admin';

# システムのデフォルト言語を日本語に設定
UPDATE mdl_config SET value='ja' WHERE name='lang';

# 確認
SELECT username, lang FROM mdl_user WHERE username='admin';
SELECT name, value FROM mdl_config WHERE name='lang';
```

### 方法3: Moodle管理画面から設定

1. 管理者でログイン
2. `Site administration` → `Language` → `Language settings`
3. `Default language`を`日本語(ja)`に変更
4. ユーザープロファイル → `Preferences` → `Preferred language`を`日本語`に変更

---

## カスタムイメージの使用

より高度な制御が必要な場合、カスタムDockerイメージを使用できます。

### カスタムイメージのビルド

```bash
# カスタムイメージをビルド
sudo docker build -f Dockerfile.moodle-ja -t moodle-ja:latest .
```

### docker-compose.ymlの変更

```yaml
services:
  moodle:
    # image: public.ecr.aws/bitnami/moodle:4.3.6  # コメントアウト
    image: moodle-ja:latest  # カスタムイメージを使用
    build:
      context: .
      dockerfile: Dockerfile.moodle-ja
    container_name: moodle-app
    # ... 以下同じ
```

### カスタムイメージの利点

- 言語設定が常に日本語で初期化される
- 追加のセットアップスクリプトを組み込める
- 本番環境での再現性が高い

---

## 言語パックの管理

### インストール済み言語の確認

```bash
# Moodleコンテナ内の言語パック確認
sudo docker exec moodle-app ls -la /bitnami/moodledata/lang/

# 出力例:
# drwxrwxr-x. 2 daemon daemon 49152 Dec 27 02:49 ja
```

### 追加の言語パックのインストール

Moodle管理画面から：
1. `Site administration` → `Language` → `Language packs`
2. 必要な言語を選択してインストール

---

## トラブルシューティング

### 問題1: ログイン後も英語のまま

**原因:** ユーザーの個別言語設定が英語になっている

**解決策:**
```bash
# 全ユーザーの言語を日本語に設定
sudo docker exec moodle-mysql mysql -u moodleuser -pmoodlepass123 bitnami_moodle -e \
  "UPDATE mdl_user SET lang='ja' WHERE deleted=0;"
```

### 問題2: 日本語言語パックが見つからない

**原因:** 言語パックがインストールされていない

**解決策:**
1. Moodle管理画面にログイン
2. `Site administration` → `Language` → `Language packs`
3. `日本語(ja)`をインストール

### 問題3: 環境変数が反映されない

**原因:** 既存のデータベースが存在する場合、MOODLE_LANGは効果がない

**解決策:**
```bash
# apply-japanese-lang.shスクリプトを実行
./apply-japanese-lang.sh
```

### 問題4: ブラウザで変更が反映されない

**原因:** ブラウザキャッシュが残っている

**解決策:**
1. ブラウザのキャッシュをクリア
2. シークレット/プライベートモードで確認
3. Moodleのキャッシュをクリア:
   ```bash
   sudo docker exec moodle-app php /bitnami/moodle/admin/cli/purge_caches.php
   ```

---

## 環境変数リファレンス

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `MOODLE_LANG` | `en` | Moodleの初期インストール言語 |
| `MOODLE_USERNAME` | `admin` | 管理者ユーザー名 |
| `MOODLE_PASSWORD` | - | 管理者パスワード |
| `MOODLE_EMAIL` | - | 管理者メールアドレス |
| `MOODLE_SITE_NAME` | `My Moodle Site` | サイト名 |

---

## 本番運用のベストプラクティス

### 1. 環境変数の管理

```bash
# .env.production
MOODLE_LANG=ja
MOODLE_SITE_NAME=本番Moodleサイト
MOODLE_EMAIL=admin@yourdomain.com
```

### 2. 定期的な設定確認

```bash
# 言語設定の確認スクリプトを定期実行
sudo docker exec moodle-mysql mysql -u moodleuser -pmoodlepass123 bitnami_moodle -e \
  "SELECT name, value FROM mdl_config WHERE name='lang';"
```

### 3. デプロイメント手順

```bash
# 1. 環境変数の設定
cp .env.production .env

# 2. コンテナの起動
sudo docker-compose up -d

# 3. 言語設定の適用（既存環境の場合）
./apply-japanese-lang.sh

# 4. 設定の確認
curl -I https://your-moodle-site.com
```

### 4. バックアップ

日本語設定を含むデータベースを定期的にバックアップ：

```bash
# データベースバックアップ
sudo docker exec moodle-mysql mysqldump -u moodleuser -pmoodlepass123 \
  bitnami_moodle > backup_$(date +%Y%m%d).sql
```

---

## 参考情報

- [Bitnami Moodle Documentation](https://github.com/bitnami/containers/tree/main/bitnami/moodle)
- [Moodle Language Documentation](https://docs.moodle.org/en/Language_packs)
- 初期化スクリプト: `scripts/init-japanese-lang.sh`
- 適用スクリプト: `apply-japanese-lang.sh`
