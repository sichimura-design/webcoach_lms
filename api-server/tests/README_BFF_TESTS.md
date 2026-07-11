# BFFサーバー Schemathesisテスト ガイド

BFFサーバー（Node.js）の全エンドポイントをSchemathesisで自動テストします。

## 📁 テストファイル

```
tests/
├── test_bff_schemathesis.py      # BFFの全エンドポイントをテスト（認証不要）
├── test_bff_authenticated.py     # 認証が必要なエンドポイントをテスト
└── README_BFF_TESTS.md           # このファイル
```

## 🎯 テスト対象エンドポイント

### test_bff_schemathesis.py でテストされるエンドポイント

| カテゴリ | エンドポイント | メソッド | 説明 |
|---------|--------------|---------|------|
| Health | `/health` | GET | ヘルスチェック |
| Health | `/api/health` | GET | APIヘルスチェック |
| Auth | `/api/login` | POST | ログイン |
| Moodle | `/api/moodle/courses` | GET | コース一覧 |
| Moodle | `/api/moodle/categories` | GET | カテゴリ一覧 |
| Moodle | `/api/moodle/badges` | GET | バッジ一覧 |
| WebCoach | `/api/webcoach/profile/{userid}` | GET/POST | プロフィール |
| WebCoach | `/api/webcoach/resumecourse/{userid}` | GET/POST | レジュームコース |
| WebCoach | `/api/webcoach/roadmaps` | GET | ロードマップ一覧 |
| WebCoach | `/api/webcoach/ai` | POST | AI質問 |

**合計: 11+ エンドポイント + 全体テスト**

### test_bff_authenticated.py でテストされるエンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/user/info` | GET | ユーザー情報取得（認証必要） |
| `/api/logout` | POST | ログアウト（認証必要） |
| `/api/moodle/courses/{userid}` | GET | ユーザーのコース一覧 |
| `/api/moodle/courses/{courseid}/contents` | GET | コース内容 |

**合計: 4+ エンドポイント**

### スキップされるエンドポイント

以下のエンドポイントは特別な処理が必要なため、基本テストではスキップされます：

- `/api/moodle/files/upload` - ファイルアップロード（multipart/form-data）
- `/api/webcoach/updatedb` - 管理者権限が必要

---

## 🚀 セットアップ

### 1. BFFサーバーを起動

```bash
cd /home/ec2-user/moodle-docker
docker-compose up -d

# 起動確認（ローカル）
curl http://localhost:3001/health

# または（nginx経由・外部IP）
curl http://YOUR_SERVER_IP/health
```

### 2. テスト依存関係をインストール

```bash
cd /home/ec2-user/moodle-docker/api-server
pip3 install -r requirements.txt
```

必要なパッケージ:
- pytest
- pytest-cov
- schemathesis
- hypothesis
- httpx
- requests

---

## 📝 テスト実行方法

### 環境変数の設定

テスト対象のBFFサーバーURLを環境変数で指定できます：

```bash
# ローカル環境（docker-compose.override.yml使用時）
export BFF_BASE_URL=http://localhost:3001

# 外部IP経由（nginx経由）
export BFF_BASE_URL=http://52.194.117.196

# または .env ファイルに記載
echo "BFF_BASE_URL=http://localhost:3001" > .env
```

### 基本テスト（認証不要エンドポイント）

```bash
cd /home/ec2-user/moodle-docker/api-server

# デフォルト（localhost:3001）でテスト
pytest tests/test_bff_schemathesis.py -v

# 環境変数で指定してテスト
BFF_BASE_URL=http://52.194.117.196 pytest tests/test_bff_schemathesis.py -v

# 特定のテストのみ実行
pytest tests/test_bff_schemathesis.py::test_health_endpoint -v

# 詳細出力
pytest tests/test_bff_schemathesis.py -v -s

# 並列実行（高速化）
pytest tests/test_bff_schemathesis.py -n auto
```

### 認証付きテスト

#### 認証情報の設定

**方法1: 環境変数（推奨）**

```bash
export TEST_MOODLE_USERNAME="your_username"
export TEST_MOODLE_PASSWORD="your_password"
```

**方法2: test_bff_authenticated.py を編集**

```python
# line 77-78 付近
test_username = "your_username"  # 変更
test_password = "your_password"  # 変更
```

#### テスト実行

```bash
# 認証付きテストを実行
pytest tests/test_bff_authenticated.py -v

# 特定のテストのみ
pytest tests/test_bff_authenticated.py::test_user_info_authenticated -v
```

### 全テストを実行

```bash
# BFF関連のすべてのテストを実行
pytest tests/test_bff_*.py -v

# すべてのテスト（API-server + BFF）
pytest tests/ -v
```

### カバレッジレポート

```bash
# HTMLレポート生成
pytest tests/test_bff_schemathesis.py --cov --cov-report=html

# レポート確認
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

---

## 🔧 カスタマイズ

### テストケース数を変更

`test_bff_schemathesis.py` の `max_examples` を変更：

```python
@settings(max_examples=10)  # デフォルト: 10回
def test_all_bff_endpoints(case):
    ...
```

- `max_examples=3`: 高速テスト（開発中）
- `max_examples=10`: 通常（デフォルト）
- `max_examples=50`: 徹底的なテスト（CI/CD）
- `max_examples=100`: プロダクション前の検証

### 特定のエンドポイントを追加テスト

```python
@schema.parametrize(endpoint="/api/your/endpoint", method="POST")
@settings(max_examples=5, deadline=None)
def test_your_custom_endpoint(case):
    response = case.call(base_url="http://localhost:3001")
    case.validate_response(response)

    # カスタム検証
    if response.status_code == 200:
        data = response.json()
        assert "expected_field" in data
```

### 認証ヘッダーを追加

`before_call` フックで認証トークンを追加：

```python
@schema.hooks.register("before_call")
def before_call(context, case):
    case.headers = case.headers or {}
    case.headers["Authorization"] = "Bearer YOUR_TOKEN"
```

---

## 📊 テスト結果の見方

### 成功時

```
tests/test_bff_schemathesis.py::test_health_endpoint[GET /health] PASSED
tests/test_bff_schemathesis.py::test_api_health_endpoint[GET /api/health] PASSED
tests/test_bff_schemathesis.py::test_login_endpoint[POST /api/login] PASSED
...
================================ 15 passed in 3.45s ================================
```

### スキップ時

```
tests/test_bff_schemathesis.py::test_all_bff_endpoints[POST /api/logout] SKIPPED (Requires authentication)
```

### 失敗時

```
tests/test_bff_schemathesis.py::test_health_endpoint[GET /health] FAILED

AssertionError: Response status code 500 is not in [200, 401, 403]
```

---

## 🐛 トラブルシューティング

### BFFサーバーが起動していない

**エラー:**
```
Connection refused
```

**解決策:**
```bash
docker-compose up -d bff-server
curl http://localhost:3001/health
```

### ポートが異なる

BFFサーバーが別のポートで動作している場合：

```python
# test_bff_schemathesis.py の base_url を変更
response = case.call(base_url="http://localhost:YOUR_PORT")
```

### 認証テストが失敗

**原因:**
- 認証情報が間違っている
- BFFサーバーの認証機能が無効

**解決策:**
```bash
# 手動でログインテスト
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

### Schemathesisのバージョンエラー

```bash
pip3 install --upgrade schemathesis hypothesis
```

---

## 📚 参考情報

### Schemathesisの主な機能

1. **自動テスト生成** - OpenAPI仕様から自動的にテストケースを生成
2. **プロパティベーステスト** - Hypothesisを使って様々な入力パターンをテスト
3. **スキーマ検証** - レスポンスがOpenAPI仕様に準拠しているか自動検証
4. **エッジケーステスト** - 境界値、null、空文字列などを自動テスト

### 自動的に検証される項目

- ✅ HTTPステータスコードがswagger.yamlで定義されているか
- ✅ Content-Typeが正しいか
- ✅ レスポンススキーマが仕様に準拠しているか
- ✅ 必須フィールドが存在するか
- ✅ データ型が正しいか（integer, string, boolean など）
- ✅ 文字列の最大長制限（maxLength）が守られているか
- ✅ 数値の最小値・最大値（minimum, maximum）が守られているか

### 関連ドキュメント

- [Schemathesis公式ドキュメント](https://schemathesis.readthedocs.io/)
- [Hypothesis公式ドキュメント](https://hypothesis.readthedocs.io/)
- [OpenAPI 3.0仕様](https://swagger.io/specification/)
- [pytest公式ドキュメント](https://docs.pytest.org/)

---

## 💡 ベストプラクティス

### 1. テストは頻繁に実行する

```bash
# コード変更後
pytest tests/test_bff_schemathesis.py -v

# CI/CDパイプラインに統合
pytest tests/test_bff_*.py --cov --cov-report=xml
```

### 2. swagger.yamlを最新に保つ

APIの変更があったら必ず `swagger.yaml` を更新する

### 3. 失敗したテストは無視しない

Schemathesisが見つけたエラーは実際のバグの可能性が高い

### 4. カスタム検証を追加する

swagger.yamlで表現できないビジネスロジックはカスタム検証を追加

```python
if response.status_code == 200:
    data = response.json()
    # ビジネスロジック検証
    assert data["progress"] >= 0 and data["progress"] <= 100
```

### 5. テスト環境を分離する

本番データを使わず、テスト専用のデータベースを使用

---

## 🎉 まとめ

このテストスイートにより、BFFサーバーの全エンドポイントが自動的にテストされます。

**メリット:**
- 手動テストの大幅削減
- リグレッションバグの早期発見
- API仕様（swagger.yaml）との整合性保証
- 境界値やエッジケースの自動テスト

**次のステップ:**
1. CI/CDパイプラインに統合
2. テストカバレッジを80%以上に
3. 定期的な実行（毎日/毎週）
