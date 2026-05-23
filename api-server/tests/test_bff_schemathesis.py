"""
Schemathesis tests for BFF Server
BFFサーバー（Node.js）の全エンドポイントをテストします

このテストは swagger.yaml に定義された全エンドポイントを自動的にテストします。
"""
import os
import schemathesis
from hypothesis import settings, HealthCheck
import pytest
import boto3
from botocore.exceptions import ClientError

# BFFサーバーのswagger.yamlを読み込み
# Docker内では /app/swagger.yaml、ホストでは絶対パス
SCHEMA_PATH = os.getenv("SWAGGER_PATH", "/home/ec2-user/moodle-docker/bff-server/swagger.yaml")
if not os.path.exists(SCHEMA_PATH) and os.path.exists("/app/swagger.yaml"):
    SCHEMA_PATH = "/app/swagger.yaml"
schema = schemathesis.openapi.from_path(SCHEMA_PATH)

# BFFサーバーのベースURL（環境変数から取得、デフォルトはlocalhost）
BFF_BASE_URL = os.getenv("BFF_BASE_URL", "http://localhost:3001")

# Cognito設定
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "ap-northeast-1_aAPBRNL7D")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "23jacbr6nk4baiftjueddmr4kb")
COGNITO_REGION = os.getenv("COGNITO_REGION", "ap-northeast-1")

# テスト用ユーザー認証情報（環境変数から取得）
TEST_USERNAME = os.getenv("TEST_COGNITO_USERNAME", "")
TEST_PASSWORD = os.getenv("TEST_COGNITO_PASSWORD", "")

# グローバル変数でトークンをキャッシュ
_cached_token = None


def get_cognito_token():
    """
    Cognito IDトークンを取得する

    環境変数から認証情報を読み取り、Cognitoで認証してIDトークンを取得します。
    トークンは1時間有効で、取得したトークンはキャッシュされます。

    環境変数:
        TEST_COGNITO_USERNAME: Cognitoユーザー名（メールアドレス）
        TEST_COGNITO_PASSWORD: パスワード

    Returns:
        str: IDトークン（JWT形式）、認証情報がない場合はNone
    """
    global _cached_token

    # すでにトークンがキャッシュされている場合は再利用
    if _cached_token:
        return _cached_token

    # 認証情報がない場合はスキップ
    if not TEST_USERNAME or not TEST_PASSWORD:
        print("⚠️  TEST_COGNITO_USERNAME または TEST_COGNITO_PASSWORD が設定されていません")
        print("   認証なしでテストを実行します（一部のエンドポイントはスキップされます）")
        return None

    try:
        # Cognito Identity Provider クライアントを作成
        client = boto3.client('cognito-idp', region_name=COGNITO_REGION)

        # USER_PASSWORD_AUTH フローで認証
        response = client.initiate_auth(
            ClientId=COGNITO_CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': TEST_USERNAME,
                'PASSWORD': TEST_PASSWORD
            }
        )

        # IDトークンを取得
        id_token = response['AuthenticationResult']['IdToken']
        _cached_token = id_token

        print(f"✅ Cognito認証成功: {TEST_USERNAME}")
        print(f"   Token (first 30 chars): {id_token[:30]}...")

        return id_token

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"❌ Cognito認証失敗: {error_code} - {error_message}")
        return None
    except Exception as e:
        print(f"❌ 認証エラー: {str(e)}")
        return None


# ==========================================
# パターン1: 全エンドポイントの基本テスト
# ==========================================

@schema.parametrize()
@settings(
    max_examples=10,
    deadline=None,
    suppress_health_check=[HealthCheck.filter_too_much, HealthCheck.too_slow]
)
def test_all_bff_endpoints(case):
    """
    BFFサーバーの全エンドポイントをテスト

    自動的に実行される検証:
    - スキーマ準拠チェック
    - ステータスコードチェック
    - レスポンス型チェック
    - 必須フィールドチェック
    """
    # ファイルアップロードは別途テスト（multipart/form-data の複雑な処理のため）
    skip_paths = [
        "/api/moodle/files/upload",
        "/api/admin/s3-upload",
    ]

    # 管理者権限が必要なエンドポイント（スキップ）
    admin_paths = [
        "/api/webcoach/updatedb",
        "/api/moodle/create-course",
        "/api/moodle/create-category",
        "/api/admin/cognito-users",
    ]

    # メソッド+パスの組み合わせでスキップが必要なもの
    skip_method_path_combinations = [
        ("POST", "/api/moodle/courses/{courseid}/tags"),  # admin only
    ]

    # 通常のパススキップ
    all_skip_paths = skip_paths + admin_paths

    if any(case.path.startswith(path) or case.path == path for path in all_skip_paths):
        pytest.skip(f"Skipping {case.path}: Requires special handling")

    # メソッド+パスの組み合わせでスキップ
    for method, path in skip_method_path_combinations:
        if case.method.upper() == method and case.path == path:
            pytest.skip(f"Skipping {case.method} {case.path}: Requires admin privileges")

    # ヘッダーを設定
    if not hasattr(case, 'headers') or case.headers is None:
        case.headers = {}

    # Cognito認証トークンを追加
    token = get_cognito_token()
    if token:
        case.headers["Authorization"] = f"Bearer {token}"

    # テストモードヘッダーを追加
    case.headers["X-Test-Mode"] = "true"

    # BFFサーバーにリクエスト送信
    try:
        response = case.call(base_url=BFF_BASE_URL)

        # レスポンスを検証（TRACEメソッドチェックを無効化）
        case.validate_response(
            response,
            exclude_checks=["unsupported_method_response"]
        )

    except Exception as e:
        # 接続エラーなどはスキップ（BFFサーバーが起動していない場合）
        if "Connection" in str(e) or "refused" in str(e):
            pytest.skip(f"BFF server not running: {e}")
        raise


# ==========================================
# 注: Schemathesis 4.x では個別のエンドポイントテストは
# test_all_bff_endpoints で全てカバーされています
# ==========================================


# ==========================================
# カスタムフック（Schemathesis 4.xでは使用しない）
# ==========================================
# 注: Schemathesis 4.xではフックAPIが変更されたため、
# test_all_bff_endpoints関数内で直接ヘッダーを設定しています


# ==========================================
# 実行方法
# ==========================================
"""
## 前提条件
BFFサーバーが起動していること

```bash
cd /home/ec2-user/moodle-docker
docker-compose up -d

# 確認
curl http://localhost:3001/health
# または
curl http://YOUR_IP/health
```

## テスト実行

### ローカル環境（docker-compose.override.yml使用）
```bash
cd /home/ec2-user/moodle-docker/api-server

# デフォルト: localhost:3001
pytest tests/test_bff_schemathesis.py -v

# または明示的に指定
BFF_BASE_URL=http://localhost:3001 pytest tests/test_bff_schemathesis.py -v
```

### 外部IPアドレス経由（nginx経由）
```bash
# 環境変数で外部IPを指定
BFF_BASE_URL=http://15.152.220.38 pytest tests/test_bff_schemathesis.py -v

# または .env ファイルに記載
echo "BFF_BASE_URL=http://15.152.220.38" > .env
pytest tests/test_bff_schemathesis.py -v

# 特定のテストのみ実行
pytest tests/test_bff_schemathesis.py::test_health_endpoint -v

# 詳細出力
pytest tests/test_bff_schemathesis.py -v -s

# カバレッジ付き
pytest tests/test_bff_schemathesis.py --cov --cov-report=html
```

## テスト内容
- Health: 2エンドポイント
- Authentication: 3エンドポイント（login, logout, user/info）
- Moodle Courses: 15+ エンドポイント（コース一覧、検索、作成、更新、削除、コンテンツ、完了状況など）
- Moodle Badges: 3エンドポイント（バッジ一覧、ユーザーバッジ、タグ）
- Moodle Activities: 4エンドポイント（完了状況の取得・更新）
- WebCoach: 10+ エンドポイント（プロフィール、AI、ロードマップ、AI applicationsなど）
- Admin: 3エンドポイント（Cognito ユーザー管理、S3アップロード）
- 合計: 40+ エンドポイント + 全体テスト

## スキップされるエンドポイント
### ファイルアップロード（multipart/form-data のため）
- /api/moodle/files/upload
- /api/admin/s3-upload

### 管理者権限が必要
- /api/webcoach/updatedb
- /api/moodle/create-course（コース作成・更新・削除）
- /api/moodle/create-category（カテゴリ作成・更新・削除）
- /api/admin/cognito-users（Cognito ユーザー管理）
- POST /api/moodle/courses/{courseid}/tags（タグ追加）
"""
