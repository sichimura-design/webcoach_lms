"""
BFFサーバーの認証が必要なエンドポイントのテスト

このテストは認証付きのエンドポイントをテストします。
実際の認証情報を使用するため、テスト環境の設定が必要です。
"""
import os
import pytest
import requests
from typing import Optional


# ==========================================
# 認証ヘルパー
# ==========================================

class BFFAuthHelper:
    """BFFサーバーの認証を管理するヘルパークラス"""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or os.getenv("BFF_BASE_URL", "http://localhost:3001")
        self.session = requests.Session()
        self.session_id: Optional[str] = None

    def login(self, username: str, password: str) -> bool:
        """
        BFFサーバーにログイン

        Args:
            username: ユーザー名
            password: パスワード

        Returns:
            ログイン成功時 True
        """
        login_url = f"{self.base_url}/api/login"
        payload = {
            "username": username,
            "password": password,
            "service": "moodle_mobile_app"
        }

        try:
            response = self.session.post(login_url, json=payload)

            if response.status_code == 200:
                # セッションIDをCookieから取得
                self.session_id = self.session.cookies.get("sessionId")
                return True
            else:
                print(f"Login failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"Login error: {e}")
            return False

    def logout(self) -> bool:
        """ログアウト"""
        logout_url = f"{self.base_url}/api/logout"

        try:
            response = self.session.post(logout_url)
            self.session_id = None
            return response.status_code == 200

        except Exception as e:
            print(f"Logout error: {e}")
            return False

    def get(self, endpoint: str) -> requests.Response:
        """認証付きGETリクエスト"""
        url = f"{self.base_url}{endpoint}"
        return self.session.get(url)

    def post(self, endpoint: str, json_data: dict) -> requests.Response:
        """認証付きPOSTリクエスト"""
        url = f"{self.base_url}{endpoint}"
        return self.session.post(url, json=json_data)


# ==========================================
# Fixtures
# ==========================================

@pytest.fixture(scope="module")
def bff_auth():
    """
    認証済みのBFF接続を提供するfixture

    使用例:
    def test_something(bff_auth):
        response = bff_auth.get("/api/user/info")
        assert response.status_code == 200
    """
    auth = BFFAuthHelper()

    # テスト用の認証情報（環境変数から取得することを推奨）
    # 実際のテストでは .env ファイルや環境変数を使用
    test_username = "admin"  # 要変更
    test_password = "Admin@123"  # 要変更

    # ログイン試行
    login_success = auth.login(test_username, test_password)

    if not login_success:
        pytest.skip("BFF server login failed - check credentials or server status")

    yield auth

    # テスト後のクリーンアップ
    auth.logout()


# ==========================================
# 認証付きエンドポイントのテスト
# ==========================================

def test_user_info_authenticated(bff_auth):
    """
    /api/user/info エンドポイントのテスト（認証必要）
    """
    response = bff_auth.get("/api/user/info")

    # 認証済みなので 200 OK が期待される
    assert response.status_code == 200

    # ユーザー情報が返される
    data = response.json()
    assert "userid" in data or "username" in data


def test_logout_authenticated(bff_auth):
    """
    /api/logout エンドポイントのテスト（認証必要）
    """
    response = bff_auth.session.post(f"{bff_auth.base_url}/api/logout")

    # ログアウト成功
    assert response.status_code in [200, 302]


@pytest.mark.parametrize("userid", [1, 2, 3])
def test_moodle_user_courses_authenticated(bff_auth, userid):
    """
    /api/moodle/courses/{userid} エンドポイントのテスト

    ユーザーごとのコース一覧を取得
    """
    response = bff_auth.get(f"/api/moodle/courses/{userid}")

    # 認証済みなので 200 または 404 が期待される
    assert response.status_code in [200, 404]

    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)


def test_moodle_course_contents_authenticated(bff_auth):
    """
    /api/moodle/courses/{courseid}/contents エンドポイントのテスト

    特定コースの内容を取得
    """
    # テスト用のコースID（実際の環境に合わせて変更）
    test_course_id = 1

    response = bff_auth.get(f"/api/moodle/courses/{test_course_id}/contents")

    # 認証済みなので 200 または 404 が期待される
    assert response.status_code in [200, 404]


def test_webcoach_profile_update_authenticated(bff_auth):
    """
    /api/webcoach/profile/{userid} (POST) エンドポイントのテスト

    プロフィール更新
    """
    test_user_id = 2  # テスト用ユーザーID

    profile_data = {
        "self_intro": "Schemathesisテストユーザー",
        "target_job": "QAエンジニア",
        "ideal_work_style": "リモートワーク",
        "badge_count": 10
    }

    response = bff_auth.post(f"/api/webcoach/profile/{test_user_id}", profile_data)

    # プロフィール更新成功
    assert response.status_code in [200, 201]

    # 更新後のデータが返される
    data = response.json()
    assert "mdl_user_id" in data


def test_webcoach_resume_course_post_authenticated(bff_auth):
    """
    /api/webcoach/resumecourse/{userid} (POST) エンドポイントのテスト

    レジュームコースの記録
    """
    test_user_id = 2

    resume_data = {
        "courseid": 1,
        "progress": 75
    }

    response = bff_auth.post(f"/api/webcoach/resumecourse/{test_user_id}", resume_data)

    # 記録成功
    assert response.status_code in [200, 201]


# ==========================================
# 認証なしでアクセスした場合のテスト
# ==========================================

def test_user_info_unauthenticated():
    """
    /api/user/info に認証なしでアクセス

    401 Unauthorized が返されることを確認
    """
    base_url = os.getenv("BFF_BASE_URL", "http://localhost:3001")
    response = requests.get(f"{base_url}/api/user/info")

    # 認証が必要なので 401 が期待される
    assert response.status_code in [401, 403]


def test_logout_unauthenticated():
    """
    /api/logout に認証なしでアクセス

    401 または 400 が返されることを確認
    """
    base_url = os.getenv("BFF_BASE_URL", "http://localhost:3001")
    response = requests.post(f"{base_url}/api/logout")

    # 認証が必要
    assert response.status_code in [400, 401, 403]


# ==========================================
# 実行方法
# ==========================================
"""
## 前提条件
1. BFFサーバーが起動していること
2. テスト用の有効な認証情報があること

## 認証情報の設定

### 方法1: 環境変数（推奨）
```bash
export TEST_MOODLE_USERNAME="admin"
export TEST_MOODLE_PASSWORD="Admin@123"
```

### 方法2: .env ファイル
```
TEST_MOODLE_USERNAME=admin
TEST_MOODLE_PASSWORD=Admin@123
```

## テスト実行

```bash
cd /home/ec2-user/moodle-docker/api-server

# 認証付きテストを実行
pytest tests/test_bff_authenticated.py -v

# 特定のテストのみ
pytest tests/test_bff_authenticated.py::test_user_info_authenticated -v

# 詳細出力
pytest tests/test_bff_authenticated.py -v -s
```

## 注意事項
- テスト用の専用アカウントを使用することを推奨
- 本番環境で実行しないこと
- 認証情報をコードに直接書かないこと
"""
