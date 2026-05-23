"""
Schemathesis-based API tests (Simplified Version)
API Server自身のOpenAPIスキーマを使用してテスト
"""
import schemathesis
from hypothesis import settings
import pytest


def test_all_endpoints(client):
    """
    全エンドポイントの基本テスト
    API Server自身のOpenAPIスキーマを使用してテスト

    これだけで以下が自動実行される:
    - スキーマ準拠チェック
    - ステータスコードチェック
    - レスポンス型チェック
    - 必須フィールドチェック
    """
    # API ServerのOpenAPIスキーマを動的に取得
    schema = schemathesis.openapi.from_asgi("/openapi.json", app=client.app)

    @schema.parametrize()
    @settings(max_examples=5, deadline=None)
    def run_test(case):
        # リクエスト送信 & レスポンス検証
        response = case.call_asgi(app=client.app)
        case.validate_response(response)

    # テスト実行
    run_test()
