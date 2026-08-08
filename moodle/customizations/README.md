# Moodle カスタマイズディレクトリ

このディレクトリには、MoodleのDockerイメージにコピーされるカスタマイズファイルを配置します。

## ディレクトリ構造

```
customizations/
├── README.md                 # このファイル
├── config.php.template       # config.phpのカスタムテンプレート
├── auth/                     # 認証プラグインのカスタマイズ
│   ├── oauth2/              # OAuth2カスタマイズ
│   │   └── cognito_patch.php
│   └── cognito/             # Cognitoカスタム認証プラグイン
│       ├── version.php
│       ├── auth.php
│       └── lang/
│           └── en/
│               └── auth_cognito.php
├── local/                    # ローカルプラグイン
│   └── custom/
│       └── version.php
└── theme/                    # カスタムテーマ
    └── custom/
        ├── config.php
        ├── logo.png
        └── custom.css
```

## カスタマイズ方法

### 1. OAuth2カスタマイズ

Cognito対応のためのOAuth2プラグインの拡張:

```php
// auth/oauth2/cognito_patch.php
<?php
namespace auth_oauth2;

class cognito_helper {
    // Cognitoカスタムロジック
}
```

### 2. config.phpのカスタマイズ

環境変数ベースの設定テンプレート:

```php
// config.php.template
$CFG->cognito_user_pool_id = getenv('COGNITO_USER_POOL_ID');
$CFG->oauth2_debug = getenv('OAUTH2_DEBUG') === 'true';
```

### 3. カスタムプラグインの追加

`local/custom/` にプラグインを配置すると、ビルド時に自動的にコピーされます。

### 4. テーマのカスタマイズ

`theme/custom/` にカスタムテーマファイルを配置します。

## ビルド方法

```bash
# カスタムイメージのビルド
cd /home/ec2-user/moodle-docker
docker build -t moodle-custom -f moodle/Dockerfile moodle/

# ECRへのプッシュ（本番環境）
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

docker tag moodle-custom:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/moodle-app:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/moodle-app:latest
```

## 開発時のテスト

```bash
# ローカルでカスタムイメージをテスト
docker-compose -f docker-compose.custom.yml up -d

# ログ確認
docker-compose logs -f moodle-app

# カスタマイズの確認
docker-compose exec moodle-app cat /opt/bitnami/moodle/config.php
```

## CI/CDでの自動化

GitHub Actionsでは、以下のワークフローで自動ビルド・デプロイされます:

1. コードプッシュ
2. `moodle/customizations/` の変更を検知
3. カスタムイメージをビルド
4. ECRにプッシュ
5. ECSに自動デプロイ

## ベストプラクティス

### ✅ DO
- カスタマイズファイルはバージョン管理に含める
- 環境変数で設定を外部化
- ビルド時にコピー（イミュータブルなイメージ）
- ドキュメント化

### ❌ DON'T
- 本番コンテナ内で直接ファイル編集
- ハードコードされた認証情報
- 手動でのパッチ適用
- ビルドキャッシュに頼りすぎる

## トラブルシューティング

### カスタマイズが反映されない

```bash
# イメージの再ビルド（キャッシュなし）
docker build --no-cache -t moodle-custom -f moodle/Dockerfile moodle/

# コンテナ内でファイルを確認
docker-compose exec moodle-app ls -la /opt/bitnami/moodle/auth/oauth2/
```

### パーミッションエラー

```bash
# Dockerfile内でchownを確認
RUN chown -R daemon:daemon /opt/bitnami/moodle
```

### データベースパッチが適用されない

```bash
# 起動ログを確認
docker-compose logs moodle-app | grep "Applying database patches"

# 手動でパッチ実行
docker-compose exec moodle-app /opt/bitnami/scripts/apply-customizations.sh
```
