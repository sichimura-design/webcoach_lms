# Moodle BFF API サーバー - デプロイメントガイド

## システム構成

このサーバーは**外部SPAからアクセスするBFF APIサーバー**として構成されています。

```
外部SPA (別サーバー/ローカル開発環境)
  ↓ HTTPS API呼び出し
https://56.155.42.38/api/*
  ↓
[EC2インスタンス]
  ├─ Nginx (HTTPS終端・リバースプロキシ)
  ├─ BFF (認証・API中継)
  ├─ Moodle (WebサービスAPI + 管理画面)
  └─ MySQL (データベース)
```

---

## 稼働中のサービス

| サービス | 機能 | アクセス |
|---------|------|---------|
| **Nginx** | HTTPS終端、リバースプロキシ | Port 80, 443 |
| **BFF** | 認証管理、API中継 | 内部のみ (3001) |
| **Moodle** | WebサービスAPI、管理画面 | 内部のみ (8080) |
| **MySQL** | データベース | 内部のみ (3306) |

---

## エンドポイント

### 1. BFF API（外部SPAから利用）
```
Base URL: https://56.155.42.38/api
```

**認証:**
- `POST /api/login` - ログイン
- `POST /api/logout` - ログアウト
- `GET /api/user/info` - ユーザー情報取得

**Moodle API:**
- `GET /api/moodle/courses` - コース一覧
- `GET /api/moodle/categories` - カテゴリ一覧
- `POST /api/moodle/courses` - コース作成
- `GET /api/moodle/courses/:id/contents` - コース内容

### 2. Moodle管理画面
```
URL: https://56.155.42.38/
ユーザー名: admin
パスワード: Admin123!
```

---

## 外部SPAからの接続方法

### 必須：CORS設定

外部SPAのオリジンをBFFの許可リストに追加する必要があります。

**1. `.env`ファイルを編集:**
```bash
cd /home/ec2-user/moodle-docker
nano .env
```

**2. `ALLOWED_ORIGINS`に外部SPAのURLを追加:**
```bash
ALLOWED_ORIGINS=https://56.155.42.38,https://your-spa-domain.com,http://localhost:3000
```

例：
- `https://my-frontend.vercel.app` - Vercelにデプロイした場合
- `http://localhost:3000` - ローカル開発環境
- `https://your-domain.com` - 本番環境

**3. BFFコンテナを再起動:**
```bash
sudo docker restart moodle-bff
```

### SPAでの実装例

```javascript
// axios設定
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://56.155.42.38',
  withCredentials: true  // ← 重要！Cookie送信に必須
});

// ログイン
const login = async (username, password) => {
  const response = await api.post('/api/login', {
    username,
    password
  });
  return response.data;
};

// カテゴリ取得（認証後）
const getCategories = async () => {
  const response = await api.get('/api/moodle/categories');
  return response.data;
};
```

**重要ポイント：**
1. `withCredentials: true` を設定（Cookie送信）
2. SPAは**HTTPS**でホストする必要がある
   - HTTP SPAからHTTPS APIへのCookieは動作しない
   - ローカル開発時は `http://localhost` なら動作する

---

## SSL証明書について

現在は**自己署名証明書**を使用しています。

### ブラウザでの証明書警告の対処
1. `https://56.155.42.38`にアクセス
2. 「詳細設定」→「56.155.42.38にアクセスする（安全ではありません）」をクリック
3. 証明書例外を追加

### 本番環境用の証明書取得（推奨）
Let's Encryptで無料の正規証明書を取得できます（ドメイン名が必要）。

---

## コンテナ管理

### 起動
```bash
cd /home/ec2-user/moodle-docker

# 手動起動（現在の方法）
sudo docker start moodle-mysql
sudo docker start moodle-app
sudo docker start moodle-bff
sudo docker start moodle-nginx
```

### 停止
```bash
sudo docker stop moodle-nginx moodle-bff moodle-app moodle-mysql
```

### ログ確認
```bash
# BFFのログ
sudo docker logs -f moodle-bff

# Nginxのログ
sudo docker logs -f moodle-nginx

# Moodleのログ
sudo docker logs -f moodle-app
```

### コンテナ状態確認
```bash
sudo docker ps
```

---

## トラブルシューティング

### 問題: SPAからAPIにアクセスできない

**原因1: CORS設定**
```bash
# BFFログでCORSエラーを確認
sudo docker logs moodle-bff | grep -i cors

# 解決策: .envにSPAのオリジンを追加
```

**原因2: Cookieが送信されない**
- SPAで`withCredentials: true`を設定しているか確認
- SPAがHTTPSでホストされているか確認（HTTPは不可）

**原因3: ポート443が開放されていない**
```bash
# セキュリティグループでポート443が開放されているか確認
curl -k https://56.155.42.38/health
```

### 問題: 認証が持続しない

**原因: Cookie設定の問題**
```bash
# BFFの環境変数を確認
sudo docker exec moodle-bff env | grep NODE_ENV

# NODE_ENV=production であることを確認
```

---

## ファイル構成

```
/home/ec2-user/moodle-docker/
├── .env                    # 環境変数
├── nginx/
│   ├── conf/nginx.conf    # Nginx設定
│   └── ssl/               # SSL証明書
│       ├── server.crt
│       └── server.key
├── bff-server/
│   ├── index.js           # BFFソースコード
│   ├── package.json
│   └── Dockerfile
├── moodle-data/           # Moodleデータ
├── moodle-html/           # Moodle HTML
└── mysql-data/            # MySQLデータ
```

---

## セキュリティ設定

### Cookie設定（BFF）
```javascript
cookie: {
  httpOnly: true,      // XSS対策
  secure: true,        // HTTPS必須
  sameSite: 'none',    // クロスオリジン許可
  maxAge: 24h          // 有効期限
}
```

### 開放ポート
- **80** (HTTP → HTTPS リダイレクト)
- **443** (HTTPS)

---

## 更新履歴

- 2025-11-23: 初期構築、HTTPS化完了、外部SPA対応
