"""
Schemathesis tests for BFF Server (Docker Network版)
Dockerネットワーク内からBFFサーバーをテストします

このファイルはDockerコンテナ内から実行することを想定しています。
BFFサーバーには `http://moodle-bff:3001` でアクセスします。
"""
import schemathesis
from hypothesis import settings, HealthCheck
import pytest

# BFFサーバーのswagger.yamlを読み込み
SCHEMA_PATH = "/home/ec2-user/moodle-docker/bff-server/swagger.yaml"
schema = schemathesis.from_path(SCHEMA_PATH)

# Dockerネットワーク内のBFFサーバーURL
BFF_BASE_URL = "http://moodle-bff:3001"


@schema.parametrize()
@settings(
    max_examples=10,
    deadline=None,
    suppress_health_check=[HealthCheck.filter_too_much, HealthCheck.too_slow]
)
def test_all_bff_endpoints(case):
    """
    BFFサーバーの全エンドポイントをテスト（Dockerネットワーク内）
    """
    # スキップするエンドポイント
    auth_required_paths = ["/api/logout", "/api/user/info"]
    skip_paths = ["/api/moodle/files/upload"]
    admin_paths = ["/api/webcoach/updatedb"]
    all_skip_paths = auth_required_paths + skip_paths + admin_paths

    if any(case.path.startswith(path) or case.path == path for path in all_skip_paths):
        pytest.skip(f"Skipping {case.path}: Requires authentication or special handling")

    try:
        # Dockerネットワーク内のBFFサーバーにリクエスト
        response = case.call(base_url=BFF_BASE_URL)
        case.validate_response(response)
    except Exception as e:
        if "Connection" in str(e) or "refused" in str(e):
            pytest.skip(f"BFF server not running: {e}")
        raise


@schema.parametrize(endpoint="/health")
@settings(max_examples=3, deadline=None)
def test_health_endpoint(case):
    """ヘルスチェックエンドポイントのテスト"""
    response = case.call(base_url=BFF_BASE_URL)
    case.validate_response(response)
    if response.status_code == 200:
        assert response.json() is not None


@schema.parametrize(endpoint="/api/health")
@settings(max_examples=3, deadline=None)
def test_api_health_endpoint(case):
    """APIヘルスチェックエンドポイントのテスト"""
    response = case.call(base_url=BFF_BASE_URL)
    case.validate_response(response)
    if response.status_code == 200:
        assert response.json() is not None


@schema.parametrize(endpoint="/api/webcoach/roadmaps", method="GET")
@settings(max_examples=5, deadline=None)
def test_webcoach_roadmaps(case):
    """WebCoachロードマップ一覧のテスト"""
    try:
        response = case.call(base_url=BFF_BASE_URL)
        case.validate_response(response)
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list) or isinstance(data, dict)
    except Exception as e:
        if "Connection" in str(e):
            pytest.skip(f"BFF server not running: {e}")
        raise


# フック
@schema.hooks.register("before_call")
def before_call(context, case):
    case.headers = case.headers or {}
    case.headers["X-Test-Mode"] = "true"


"""
実行方法:

## Dockerネットワーク内から実行（api-serverコンテナを使用）

```bash
# api-serverコンテナに入る
docker exec -it moodle-api bash

# テストを実行
cd /app
pytest tests/test_bff_docker.py -v
```

## ホストマシンから実行（要: docker-composeの修正）

docker-compose.ymlのbff-serverセクションに以下を追加:
```yaml
bff-server:
  ports:
    - "3001:3001"
```

その後、`test_bff_schemathesis.py` を使用してテスト可能
"""
