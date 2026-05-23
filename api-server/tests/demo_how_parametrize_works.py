"""
@schema.parametrize() がどのように動作するかのデモ

実際に何が起きているかを確認するためのコード
"""
import schemathesis

SCHEMA_PATH = "/home/ec2-user/moodle-docker/bff-server/swagger.yaml"
schema = schemathesis.from_path(SCHEMA_PATH)


# ==========================================
# デモ1: @schema.parametrize() なしの場合
# ==========================================

def demo_without_parametrize():
    """
    @schema.parametrize() を使わない場合、
    手動で全エンドポイントをテストする必要がある
    """
    print("=== @schema.parametrize() なしの場合 ===")
    print("以下のテストを手動で書く必要がある:\n")

    # エンドポイント1: /health
    def test_health():
        # GET /health のテスト
        pass

    # エンドポイント2: /api/health
    def test_api_health():
        # GET /api/health のテスト
        pass

    # エンドポイント3: /api/login
    def test_login():
        # POST /api/login のテスト
        pass

    # エンドポイント4: /api/logout
    def test_logout():
        # POST /api/logout のテスト
        pass

    # ... 他にも数十個のエンドポイント
    # 全部手動で書く必要がある！

    print("✗ 手動で数十個のテスト関数を書く必要がある")
    print("✗ 新しいエンドポイントが追加されるたびに追加が必要")
    print()


# ==========================================
# デモ2: @schema.parametrize() ありの場合
# ==========================================

@schema.parametrize()
def test_all_endpoints_automatically(case):
    """
    この関数は swagger.yaml に定義された
    「全エンドポイント × 全HTTPメソッド」の回数だけ実行される

    例: swagger.yaml に 50個のエンドポイントがあれば、
        この関数は 50回以上実行される
    """
    print(f"Testing: {case.method} {case.path}")
    # case.call() でリクエスト送信
    # case.validate_response() でレスポンス検証


def demo_with_parametrize():
    """
    @schema.parametrize() がどう動作するかのデモ
    """
    print("=== @schema.parametrize() ありの場合 ===")
    print("swagger.yaml から以下のエンドポイントが自動抽出される:\n")

    # swagger.yaml を解析してエンドポイント一覧を取得
    # （実際にはSchemathesisが内部で行う処理）

    print("エンドポイント一覧:")
    print("1. GET  /health")
    print("2. GET  /api/health")
    print("3. POST /api/login")
    print("4. POST /api/logout")
    print("5. GET  /api/user/info")
    print("6. GET  /api/moodle/courses")
    print("7. GET  /api/moodle/courses/{userid}")
    print("8. GET  /api/moodle/courses/search")
    print("9. GET  /api/moodle/categories")
    print("10. GET  /api/moodle/courses/{courseid}/contents")
    print("11. POST /api/moodle/courses/{courseid}/activities")
    print("12. GET  /api/moodle/getcoursebyfield")
    print("13. POST /api/moodle/files/upload")
    print("14. POST /api/moodle/api")
    print("15. GET  /api/moodle/badges")
    print("16. GET  /api/moodle/user-badges/{userid}")
    print("17. GET  /api/webcoach/profile/{userid}")
    print("18. POST /api/webcoach/profile/{userid}")
    print("19. GET  /api/webcoach/resumecourse/{userid}")
    print("20. POST /api/webcoach/resumecourse/{userid}")
    print("21. GET  /api/webcoach/recomendbadge/{userid}")
    print("22. GET  /api/webcoach/roadmaps")
    print("23. GET  /api/webcoach/roadmap/{roadmapid}")
    print("24. POST /api/webcoach/ai")
    print("25. POST /api/webcoach/updatedb")
    print("... など、合計25個以上のエンドポイント\n")

    print("✓ test_all_endpoints_automatically() が 25回以上実行される")
    print("✓ 各実行で異なるエンドポイントがテストされる")
    print("✓ さらに @settings(max_examples=10) なら 25 × 10 = 250回実行")
    print()


# ==========================================
# デモ3: 実際の実行イメージ
# ==========================================

def demo_actual_execution():
    """
    @schema.parametrize() 使用時の実際の実行イメージ
    """
    print("=== 実際の実行イメージ ===\n")

    # pytest を実行すると...
    print("$ pytest tests/test_api_schemathesis.py::test_all_endpoints_automatically -v\n")

    # 以下のように、同じ関数が異なるパラメータで複数回実行される
    print("実行されるテスト:")
    print("test_all_endpoints_automatically[GET /health] PASSED")
    print("test_all_endpoints_automatically[GET /api/health] PASSED")
    print("test_all_endpoints_automatically[POST /api/login] PASSED")
    print("test_all_endpoints_automatically[POST /api/logout] PASSED")
    print("test_all_endpoints_automatically[GET /api/user/info] PASSED")
    print("test_all_endpoints_automatically[GET /api/moodle/courses] PASSED")
    print("test_all_endpoints_automatically[GET /api/moodle/courses/1] PASSED")
    print("test_all_endpoints_automatically[GET /api/moodle/courses/123] PASSED")
    print("test_all_endpoints_automatically[POST /api/webcoach/profile/1] PASSED")
    print("test_all_endpoints_automatically[POST /api/webcoach/profile/999] PASSED")
    print("... 計250個のテストが実行される\n")

    print("✓ 1つの関数定義で 250個のテストが自動実行される！")
    print()


# ==========================================
# デモ4: フィルタリングの必要性
# ==========================================

def demo_why_filtering_needed():
    """
    なぜ test_api_schemathesis.py でフィルタリングしているのか
    """
    print("=== フィルタリングが必要な理由 ===\n")

    print("swagger.yaml には BFF サーバーのエンドポイントも含まれている:")
    print("- /api/login       ← BFFサーバー専用（api-serverにはない）")
    print("- /api/logout      ← BFFサーバー専用（api-serverにはない）")
    print("- /api/moodle/*    ← BFFサーバー専用（api-serverにはない）")
    print()

    print("api-server には以下のエンドポイントのみ存在:")
    print("- /health")
    print("- /api/webcoach/*  ← これだけテストしたい")
    print()

    print("そのため、test_api_schemathesis.py では:")
    print("""
    @schema.parametrize()
    def test_api_endpoints(case):
        # フィルタリング: api-server に存在するエンドポイントのみテスト
        if not any(case.path.startswith(path) for path in webcoach_paths):
            pytest.skip("Not an API server endpoint")

        # ここに到達するのは /api/webcoach/* のみ
        response = case.call(base_url="http://testserver")
        case.validate_response(response)
    """)
    print()
    print("✓ 全エンドポイントが生成されるが、不要なものはスキップ")
    print()


# ==========================================
# デモ5: 実際にswagger.yamlから何が読み取られるか
# ==========================================

def demo_what_is_extracted():
    """
    実際に swagger.yaml から何が抽出されるか確認
    """
    print("=== swagger.yaml から抽出される情報 ===\n")

    # Schemathesisでスキーマを読み込む
    schema = schemathesis.from_path(SCHEMA_PATH)

    print("抽出されたエンドポイント一覧:")

    # 全エンドポイントをカウント
    endpoint_count = 0

    # スキーマから全操作を取得
    # （注: 実際のAPIは異なる場合があるため、簡略化して説明）
    for endpoint in schema.get_all_operations():
        endpoint_count += 1
        if endpoint_count <= 10:  # 最初の10個だけ表示
            print(f"{endpoint_count}. {endpoint.method.upper()} {endpoint.path}")

    print(f"... など、合計 {endpoint_count} 個のエンドポイント × HTTPメソッド")
    print()
    print(f"✓ @schema.parametrize() は {endpoint_count} 回テストを実行する")
    print(f"✓ @settings(max_examples=10) なら {endpoint_count * 10} 回実行される")
    print()


# ==========================================
# メイン実行
# ==========================================

if __name__ == "__main__":
    print("=" * 60)
    print("@schema.parametrize() の動作デモ")
    print("=" * 60)
    print()

    demo_without_parametrize()
    print()

    demo_with_parametrize()
    print()

    demo_actual_execution()
    print()

    demo_why_filtering_needed()
    print()

    # 実際にswagger.yamlから情報を抽出
    try:
        demo_what_is_extracted()
    except Exception as e:
        print(f"エラー: {e}")
        print("（swagger.yamlの読み込みに失敗した場合）")
