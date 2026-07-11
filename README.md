# Moodle + MySQL Docker環境（EC2用）

この環境では、DockerでMySQLとMoodleを動かします。外部からのアクセスにも対応しています。

## 構成

- **MySQL 8.0**: データベースサーバー
- **Bitnami Moodle**: Moodle LMS（最新版）
- データの永続化: ホストにマウント
- 外部アクセス: EC2の公開IPアドレスで自動設定

## ディレクトリ構造

```
moodle-docker/
├── start-moodle.sh           # 起動スクリプト
├── stop-moodle.sh            # 停止スクリプト
├── check-security-group.sh   # セキュリティグループ確認スクリプト
├── README.md                 # このファイル
├── mysql-data/               # MySQLのデータ（自動作成）
├── moodle-data/              # Moodleのデータ（自動作成）
└── moodle-html/              # Moodleのファイル（自動作成）
```

## 初回セットアップ

### 1. セキュリティグループの確認

外部からアクセスするには、ポート8080が開いている必要があります：

```bash
cd /home/ec2-user/moodle-docker
./check-security-group.sh
```

ポートが開いていない場合は、表示されるコマンドを実行してポートを開いてください。

または、AWSコンソールから手動で設定：
1. EC2コンソールを開く
2. インスタンスを選択
3. セキュリティタブ → セキュリティグループをクリック
4. インバウンドルールを編集
5. ルールを追加:
   - タイプ: カスタムTCP
   - ポート: 8080
   - ソース: 0.0.0.0/0（または特定のIPアドレス）

### 2. Moodleを起動

```bash
./start-moodle.sh
```

初回起動時は以下の処理が行われます：
1. EC2の公開IPアドレスを自動検出
2. Dockerネットワークの作成
3. 必要なディレクトリの作成
4. MySQLコンテナの起動とデータベース初期化
5. Moodleコンテナの起動とセットアップ

初回セットアップには5〜10分程度かかります。

### 3. APIユーザーのセットアップ（BFF使用時）

BFFサーバーからMoodle APIを使用する場合は、専用のサービスアカウント（apiuser）を設定します：

```bash
./setup-apiuser.sh
```

このスクリプトは以下を実行します：
1. **apiuser**アカウントの作成
2. 必要なロール（webserviceuser, manager）の割り当て
3. **moodle-api-service**の設定
4. APIトークンの確認

**重要:**
- `core_user_get_users_by_field`などの一部のAPI関数は管理者レベルの権限が必要です
- apiuserには`manager`ロールが自動的に付与されます
- トークンが存在しない場合は、Moodle管理画面から手動で生成してください

手動でトークンを生成する手順：
1. Moodleに管理者でログイン
2. サイト管理 > サーバ > Webサービス > トークンを管理する
3. 新しいトークンを作成：
   - ユーザー: apiuser
   - サービス: moodle-api-service
4. 生成されたトークンを`.env`ファイルに設定

## アクセス方法

起動スクリプトが表示するURLにアクセスしてください：
```
http://<EC2の公開IP>:8080
```

### デフォルトログイン情報

- **ユーザー名**: admin
- **パスワード**: Admin123!

## ログの確認

Moodleのセットアップ状況を確認するには：
```bash
sudo docker logs -f moodle-app
```

MySQLのログを確認するには：
```bash
sudo docker logs -f moodle-mysql
```

`Ctrl + C` でログ表示を終了できます。

## 停止方法

```bash
./stop-moodle.sh
```

データは保持されます。再度 `./start-moodle.sh` で起動すると以前の状態から継続できます。

## コンテナの状態確認

実行中のコンテナを確認：
```bash
sudo docker ps
```

すべてのコンテナを確認（停止中も含む）：
```bash
sudo docker ps -a
```

## データベース接続情報

Moodleは以下の設定でMySQLに接続しています：

- **ホスト**: moodle-mysql（コンテナ名）
- **ポート**: 3306
- **データベース名**: moodle
- **ユーザー名**: moodleuser
- **パスワード**: moodlepass123

## トラブルシューティング

### 外部からアクセスできない（ERR_CONNECTION_TIMED_OUT）

1. セキュリティグループでポート8080が開いているか確認：
   ```bash
   ./check-security-group.sh
   ```

2. コンテナが起動しているか確認：
   ```bash
   sudo docker ps
   ```

3. ポートがリッスンしているか確認：
   ```bash
   sudo netstat -tlnp | grep 8080
   ```

### ポート8080が既に使用されている場合

`start-moodle.sh` の以下の行を編集して別のポートに変更：
```bash
-p 0.0.0.0:8080:8080 \
```
例: `-p 0.0.0.0:9090:8080 \` に変更すると、http://<IP>:9090 でアクセス可能

セキュリティグループでも新しいポートを開く必要があります。

### コンテナを完全にリセットしたい場合

```bash
# コンテナを停止
./stop-moodle.sh

# コンテナを削除
sudo docker rm moodle-app moodle-mysql

# データを削除（注意：すべてのデータが失われます）
rm -rf mysql-data/ moodle-data/ moodle-html/

# 再起動
./start-moodle.sh
```

### MySQLに直接接続したい場合

```bash
sudo docker exec -it moodle-mysql mysql -u moodleuser -pmoodlepass123 moodle
```

### Dockerの権限エラーが出る場合

現在のセッションを再起動するか、sudoを使用してください：
```bash
# ログアウト/ログイン、または
newgrp docker
```

## カスタマイズ

パスワードやデータベース名を変更したい場合は、`start-moodle.sh` の以下の変数を編集してください：

```bash
MYSQL_ROOT_PASSWORD="rootpassword123"
MYSQL_DATABASE="moodle"
MYSQL_USER="moodleuser"
MYSQL_PASSWORD="moodlepass123"
```

変更後は、一度環境を完全にリセットしてから再起動してください。

## セキュリティに関する注意

- **本番環境**:
  - デフォルトのパスワードを必ず変更してください
  - セキュリティグループで信頼できるIPアドレスのみを許可してください
  - HTTPSを設定することを推奨します（nginxやCloudFrontなどのリバースプロキシ経由）

- **テスト環境**:
  - 不要になったらインスタンスを停止または削除してください
  - セキュリティグループでポートを閉じてください

## BFF（Backend for Frontend）の設定

### サービスアカウントの設定

BFFは全てのMoodle API呼び出しにサービスアカウントを使用します。`.env`ファイルで以下の環境変数を設定してください：

```bash
# .env ファイル
MOODLE_SERVICE_USERNAME=your_service_account_username
MOODLE_SERVICE_PASSWORD=your_service_account_password
MOODLE_SERVICE_NAME=moodle_mobile_app
```

### 重要な注意点

1. **認証の仕組み**：
   - エンドユーザーのログイン認証はBFFで管理
   - Moodle APIへのアクセスは全てサービスアカウントのトークンで実行
   - サービスアカウントのトークンは12時間ごとに自動更新

2. **セキュリティ**：
   - サービスアカウントには必要最小限の権限のみを付与
   - `webservice/rest:use` capabilityが必要
   - エンドユーザーには`webservice/rest:use`を付与する必要はありません

3. **BFFの起動**：
   - サービスアカウントの認証情報が設定されていない場合、BFFは起動に失敗します
   - 起動時にサービスアカウントでログインしてトークンを取得します

## システム要件

- Docker 20.10以降
- AWS EC2インスタンス（Amazon Linux 2023推奨）
- 空きディスク容量: 最低5GB
- メモリ: 最低2GB推奨
- AWS CLI（セキュリティグループ確認用、オプション）
