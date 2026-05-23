"""
Schemathesis が swagger.yaml から読み取る情報の具体例

このファイルは、OpenAPI仕様からどのような情報が自動で読み取られ、
テストに活用されるかを示すデモンストレーションです。
"""
import schemathesis

SCHEMA_PATH = "/home/ec2-user/moodle-docker/bff-server/swagger.yaml"
schema = schemathesis.from_path(SCHEMA_PATH)


def demonstrate_schema_extraction():
    """
    Schemathesisが読み取る情報の例
    """

    # ========================================
    # 1. エンドポイント情報（パス）
    # ========================================
    # swagger.yaml の paths セクションから読み取る
    # 例:
    #   /api/webcoach/profile/{userid}
    #   /api/webcoach/resumecourse/{userid}
    #   /api/health

    print("=== 読み取られるエンドポイント ===")
    print("- /api/webcoach/profile/{userid}")
    print("- /api/webcoach/resumecourse/{userid}")
    print("- /api/health")
    print()


    # ========================================
    # 2. HTTPメソッド
    # ========================================
    # 各エンドポイントで使用可能なメソッドを読み取る
    # 例: GET, POST, PUT, DELETE など

    print("=== 読み取られるHTTPメソッド ===")
    print("/api/webcoach/profile/{userid}:")
    print("  - GET  (プロフィール取得)")
    print("  - POST (プロフィール更新)")
    print()


    # ========================================
    # 3. パスパラメータ
    # ========================================
    # swagger.yaml から以下を読み取る:
    """
    parameters:
      - name: userid
        in: path
        required: true
        schema:
          type: integer
    """
    # Schemathesisは自動的に:
    # - userid に整数値を生成
    # - 必須パラメータをチェック
    # - 様々な整数値でテスト（正の数、負の数、0、大きな数など）

    print("=== パスパラメータの自動生成 ===")
    print("userid (integer, required)")
    print("  自動生成される値の例:")
    print("  - 1, 2, 100, 9999")
    print("  - 0 (境界値)")
    print("  - -1 (負の数)")
    print("  - 2147483647 (最大値)")
    print()


    # ========================================
    # 4. クエリパラメータ
    # ========================================
    # swagger.yaml から読み取る:
    """
    /api/webcoach/resumecourse/{userid}:
      get:
        parameters:
          - name: limit
            in: query
            schema:
              type: integer
              default: 5
    """
    # Schemathesisは:
    # - limit パラメータを様々な値でテスト
    # - デフォルト値を考慮
    # - 省略可能かどうかをチェック

    print("=== クエリパラメータの自動生成 ===")
    print("limit (integer, default: 5)")
    print("  自動生成されるリクエスト:")
    print("  - /api/webcoach/resumecourse/1")
    print("  - /api/webcoach/resumecourse/1?limit=5")
    print("  - /api/webcoach/resumecourse/1?limit=10")
    print("  - /api/webcoach/resumecourse/1?limit=0")
    print()


    # ========================================
    # 5. リクエストボディ（スキーマ）
    # ========================================
    # swagger.yaml から読み取る:
    """
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ProfileUpdate'

    ProfileUpdate:
      type: object
      properties:
        self_intro:
          type: string
          nullable: true
        target_job:
          type: string
          maxLength: 256
          nullable: true
        badge_count:
          type: integer
          minimum: 0
          nullable: true
    """
    # Schemathesisは自動的に:
    # - 様々なJSONボディを生成
    # - 型制約をチェック（string, integer）
    # - 長さ制約をチェック（maxLength: 256）
    # - 値の範囲をチェック（minimum: 0）
    # - nullable のテスト

    print("=== リクエストボディの自動生成 ===")
    print("ProfileUpdate スキーマから生成される例:")
    print("""
  {
    "self_intro": "テストユーザーです",
    "target_job": "エンジニア",
    "badge_count": 5
  }

  {
    "self_intro": null,
    "target_job": "a" * 256,
    "badge_count": 0
  }

  {
    "badge_count": 999999
  }

  {} (空オブジェクト - 全てoptional)
    """)


    # ========================================
    # 6. レスポンススキーマ
    # ========================================
    # swagger.yaml から読み取る:
    """
    responses:
      '200':
        description: User profile retrieved successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Profile'

    Profile:
      type: object
      required:
        - mdl_user_id
      properties:
        mdl_user_id:
          type: integer
        self_intro:
          type: string
          nullable: true
        target_job:
          type: string
          nullable: true
        badge_count:
          type: integer
          nullable: true
          default: 0
    """
    # Schemathesisは自動的に:
    # - レスポンスが200の場合、Profileスキーマに準拠しているか検証
    # - 必須フィールド（mdl_user_id）が存在するかチェック
    # - 各フィールドの型が正しいかチェック
    # - nullable フィールドがnullを返せるかチェック

    print("=== レスポンススキーマの検証 ===")
    print("Profile スキーマの検証項目:")
    print("  ✓ mdl_user_id が存在するか（required）")
    print("  ✓ mdl_user_id が integer 型か")
    print("  ✓ self_intro が string または null か")
    print("  ✓ target_job が string または null か")
    print("  ✓ badge_count が integer または null か")
    print()


    # ========================================
    # 7. ステータスコード
    # ========================================
    # swagger.yaml から読み取る:
    """
    responses:
      '200':
        description: Profile updated successfully
      '401':
        description: Not authenticated
      '403':
        description: Forbidden
      '500':
        description: Failed to update profile
    """
    # Schemathesisは:
    # - 定義されたステータスコードが返ってくるかチェック
    # - 定義されていないステータスコードが返るとエラー

    print("=== ステータスコードの検証 ===")
    print("許可されるステータスコード:")
    print("  - 200: 成功")
    print("  - 401: 認証エラー")
    print("  - 403: アクセス拒否")
    print("  - 500: サーバーエラー")
    print()
    print("それ以外のステータスコードが返るとテスト失敗")
    print()


    # ========================================
    # 8. データ型の制約
    # ========================================
    # swagger.yaml から読み取る制約:
    """
    properties:
      target_job:
        type: string
        maxLength: 256
        nullable: true

      badge_count:
        type: integer
        minimum: 0
        nullable: true

      progress_percent:
        type: integer
        minimum: 0
        maximum: 100
    """
    # Schemathesisは境界値テストを自動生成:

    print("=== データ型制約と境界値テスト ===")
    print("maxLength: 256 の場合:")
    print("  - 空文字列")
    print("  - 1文字")
    print("  - 256文字（境界値）")
    print("  - 257文字（制約違反）")
    print()
    print("minimum: 0, maximum: 100 の場合:")
    print("  - -1 (制約違反)")
    print("  - 0  (境界値)")
    print("  - 50 (通常値)")
    print("  - 100 (境界値)")
    print("  - 101 (制約違反)")
    print()


    # ========================================
    # 9. 認証情報
    # ========================================
    # swagger.yaml から読み取る:
    """
    security:
      - cookieAuth: []

    components:
      securitySchemes:
        cookieAuth:
          type: apiKey
          in: cookie
          name: sessionId
    """
    # Schemathesisは:
    # - セキュリティスキームを認識
    # - 認証が必要なエンドポイントを識別
    # - 認証なしのリクエストもテスト（401を期待）

    print("=== 認証情報の読み取り ===")
    print("cookieAuth (apiKey in cookie):")
    print("  - 認証必須エンドポイントを識別")
    print("  - Cookie: sessionId の有無でテスト")
    print("  - 認証なし → 401 を期待")
    print("  - 認証あり → 200/その他を期待")
    print()


    # ========================================
    # 10. Content-Type
    # ========================================
    # swagger.yaml から読み取る:
    """
    requestBody:
      content:
        application/json:
          schema: ...

        multipart/form-data:
          schema: ...
    """
    # Schemathesisは:
    # - 各Content-Typeでテスト
    # - application/json, multipart/form-data などを自動判別

    print("=== Content-Type の読み取り ===")
    print("認識されるContent-Type:")
    print("  - application/json")
    print("  - multipart/form-data (ファイルアップロード)")
    print()


# ========================================
# 実際のテスト例
# ========================================

@schema.parametrize(endpoint="/api/webcoach/profile/{userid}", method="POST")
def test_profile_update_with_schema_validation(case):
    """
    Schemathesis が自動的に行うこと:

    1. userid に様々な整数値を生成
       例: 1, 2, 0, -1, 999999

    2. リクエストボディを ProfileUpdate スキーマから生成
       例:
       - {"self_intro": "test", "target_job": "engineer", "badge_count": 5}
       - {"self_intro": null, "target_job": null, "badge_count": 0}
       - {"badge_count": 100}
       - {}

    3. リクエスト送信
       POST /api/webcoach/profile/1
       Content-Type: application/json
       Body: {"self_intro": "test", ...}

    4. レスポンス検証
       - ステータスコードが 200/401/403/500 のいずれか
       - 200 の場合、レスポンスが Profile スキーマに準拠
       - 必須フィールド (mdl_user_id) が存在
       - 各フィールドの型が正しい

    5. エラーケースのテスト
       - 不正な型のデータを送信
       - 制約を超える値を送信
       - 必須フィールドを省略
    """
    response = case.call(base_url="http://testserver")
    case.validate_response(response)


if __name__ == "__main__":
    demonstrate_schema_extraction()
