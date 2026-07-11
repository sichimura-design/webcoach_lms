# API Server Tests

このディレクトリには api-server のユニットテストとAPIテストが含まれています。

## テスト構成

```
tests/
├── __init__.py           # テストパッケージ初期化
├── conftest.py           # pytest設定とfixture定義
├── test_api_schemathesis.py  # Schemathesisを使ったAPIテスト
├── test_crud.py          # CRUD操作のユニットテスト
└── README.md            # このファイル
```

## セットアップ

### 1. テスト用依存関係のインストール

```bash
cd /home/ec2-user/moodle-docker/api-server
pip install -r requirements.txt
```

### 2. 環境変数の設定

テスト実行時は `.env` ファイルが自動的に読み込まれます。

## テストの実行方法

### すべてのテストを実行

```bash
pytest
```

### 特定のテストファイルを実行

```bash
# CRUD テストのみ
pytest tests/test_crud.py

# Schemathesis テストのみ
pytest tests/test_api_schemathesis.py
```

### 特定のテストクラスや関数を実行

```bash
# 特定のクラス
pytest tests/test_crud.py::TestUserProfile

# 特定のテスト関数
pytest tests/test_crud.py::TestUserProfile::test_create_user_profile
```

### カバレッジレポート付きで実行

```bash
pytest --cov=. --cov-report=html
```

実行後、`htmlcov/index.html` をブラウザで開いてカバレッジを確認できます。

### 詳細な出力で実行

```bash
pytest -v
```

### 失敗したテストのみ再実行

```bash
pytest --lf
```

## Schemathesis について

Schemathesis は OpenAPI/Swagger 仕様から自動的にテストを生成するツールです。

### 主な機能

1. **自動テスト生成** - swagger.yaml から API エンドポイントのテストを自動生成
2. **プロパティベーステスト** - Hypothesis を使って多様な入力パターンをテスト
3. **スキーマ検証** - レスポンスが OpenAPI 仕様に準拠しているか検証

### Schemathesis のカスタマイズ

`tests/test_api_schemathesis.py` で以下をカスタマイズできます：

- **max_examples**: 各エンドポイントで生成するテストケース数
- **deadline**: テストのタイムアウト時間
- **hooks**: リクエスト前後の処理（認証ヘッダ追加など）

## テストファイルの説明

### conftest.py

すべてのテストで共通して使用する設定とfixture:

- `test_db`: テスト用のSQLiteインメモリデータベース
- `client`: FastAPI TestClient（テスト用DB付き）
- `sample_user_profile`: サンプルユーザーデータ
- `sample_course_access`: サンプルコースアクセスデータ

### test_crud.py

CRUD操作の単体テスト:

- ユーザープロフィールの作成・取得・更新
- コースアクセスの記録・更新
- レジュームコースの取得

### test_api_schemathesis.py

Schemathesis を使った API テスト:

- 全エンドポイントの自動テスト
- レスポンススキーマ検証
- プロパティベーステスト

## トラブルシューティング

### インポートエラーが発生する場合

```bash
export PYTHONPATH=/home/ec2-user/moodle-docker/api-server:$PYTHONPATH
pytest
```

### データベース接続エラー

テストではSQLiteインメモリDBを使用するため、本番のMySQLは不要です。

### Schemathesis でテストがスキップされる

`test_api_schemathesis.py` の `webcoach_paths` リストを確認し、
テストしたいエンドポイントが含まれているか確認してください。

## CI/CD での実行

GitHub Actions や Jenkins などで実行する場合:

```yaml
# .github/workflows/test.yml の例
- name: Run tests
  run: |
    cd api-server
    pip install -r requirements.txt
    pytest --cov=. --cov-report=xml
```

## ベストプラクティス

1. **テストは独立して実行可能に** - 各テストは他のテストに依存しない
2. **テストデータはfixtureで管理** - conftest.py で一元管理
3. **テスト用DBは毎回クリーンな状態から** - SQLiteインメモリで高速化
4. **カバレッジ80%以上を目標** - 重要な機能は必ずテスト

## 参考リンク

- [pytest ドキュメント](https://docs.pytest.org/)
- [Schemathesis ドキュメント](https://schemathesis.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
