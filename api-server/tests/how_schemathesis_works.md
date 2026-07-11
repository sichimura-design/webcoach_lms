# Schemathesis の実装箇所と動作の詳細解説

## 1. スキーマの読み込み（Line 14）

```python
schema = schemathesis.from_path(SCHEMA_PATH)
```

### 内部で行われる処理:

1. **YAMLファイルの解析**
   ```python
   # Schemathesisライブラリ内部で実行される処理（擬似コード）
   with open(SCHEMA_PATH) as f:
       yaml_content = yaml.safe_load(f)

   # OpenAPI仕様の解析
   openapi_spec = {
       'paths': {
           '/api/webcoach/profile/{userid}': {
               'get': {...},
               'post': {...}
           },
           '/api/webcoach/resumecourse/{userid}': {
               'get': {...},
               'post': {...}
           }
       },
       'components': {
           'schemas': {
               'Profile': {...},
               'ProfileUpdate': {...}
           }
       }
   }
   ```

2. **エンドポイントの抽出**
   ```python
   # Schemathesis内部で以下のようなデータ構造を作成
   endpoints = [
       {
           'path': '/api/webcoach/profile/{userid}',
           'method': 'GET',
           'parameters': [{'name': 'userid', 'type': 'integer', 'in': 'path'}],
           'responses': {'200': {...}, '401': {...}}
       },
       {
           'path': '/api/webcoach/profile/{userid}',
           'method': 'POST',
           'parameters': [{'name': 'userid', 'type': 'integer', 'in': 'path'}],
           'requestBody': {'schema': {'$ref': '#/components/schemas/ProfileUpdate'}},
           'responses': {'200': {...}, '401': {...}}
       },
       # ... 他のエンドポイント
   ]
   ```

3. **スキーマ参照の解決**
   ```python
   # $ref の解決
   # '$ref': '#/components/schemas/ProfileUpdate'
   # ↓ 実際のスキーマに展開
   {
       'type': 'object',
       'properties': {
           'self_intro': {'type': 'string', 'nullable': True},
           'target_job': {'type': 'string', 'maxLength': 256, 'nullable': True},
           'badge_count': {'type': 'integer', 'minimum': 0, 'nullable': True}
       }
   }
   ```

---

## 2. テストケースの自動生成（Line 26）

```python
@schema.parametrize()
@settings(max_examples=10, deadline=None)
def test_api_endpoints(case, schema_test_client):
```

### `@schema.parametrize()` デコレータの動作:

```python
# Schemathesisが内部で実行する処理（擬似コード）

# 1. swagger.yamlから全エンドポイントを取得
all_endpoints = schema.get_all_endpoints()

# 2. 各エンドポイント × HTTPメソッドの組み合わせでテストケースを生成
for endpoint in all_endpoints:
    for method in endpoint.methods:  # GET, POST, etc.
        # テストケースオブジェクトを作成
        case = Case(
            path=endpoint.path,           # '/api/webcoach/profile/{userid}'
            method=method,                # 'GET' or 'POST'
            path_parameters=generate_path_params(endpoint),
            query=generate_query_params(endpoint),
            body=generate_request_body(endpoint),
            headers=generate_headers(endpoint)
        )

        # test_api_endpoints(case, schema_test_client) を実行
        yield case
```

### パラメータ生成の具体例:

```python
# generate_path_params の内部動作（擬似コード）
def generate_path_params(endpoint):
    # swagger.yamlから読み取った情報:
    # parameters:
    #   - name: userid
    #     in: path
    #     schema:
    #       type: integer

    # Hypothesisを使って様々な整数を生成
    from hypothesis import strategies as st

    userid_strategy = st.integers()

    # 実際に生成される値の例:
    # userid = 0
    # userid = 1
    # userid = -1
    # userid = 999999
    # userid = 2147483647

    return {'userid': generated_value}
```

```python
# generate_request_body の内部動作（擬似コード）
def generate_request_body(endpoint):
    # POST /api/webcoach/profile/{userid} の場合
    # requestBody:
    #   schema:
    #     $ref: '#/components/schemas/ProfileUpdate'

    # ProfileUpdate スキーマ:
    # {
    #   'properties': {
    #     'self_intro': {'type': 'string', 'nullable': True},
    #     'target_job': {'type': 'string', 'maxLength': 256},
    #     'badge_count': {'type': 'integer', 'minimum': 0}
    #   }
    # }

    # Hypothesisを使ってJSONを生成
    from hypothesis import strategies as st

    # 生成例1:
    body = {
        'self_intro': 'テストユーザーです',
        'target_job': 'エンジニア',
        'badge_count': 5
    }

    # 生成例2: null値のテスト
    body = {
        'self_intro': None,
        'target_job': None,
        'badge_count': 0
    }

    # 生成例3: 境界値テスト
    body = {
        'target_job': 'a' * 256,  # maxLength: 256
        'badge_count': 0          # minimum: 0
    }

    return body
```

---

## 3. リクエストの実行（Line 53）

```python
response = case.call(base_url="http://testserver")
```

### `case.call()` の内部動作:

```python
# Schemathesisの Case クラス内部（擬似コード）
class Case:
    def __init__(self, path, method, path_parameters, query, body, headers):
        self.path = path
        self.method = method
        self.path_parameters = path_parameters
        self.query = query
        self.body = body
        self.headers = headers

    def call(self, base_url):
        # 1. パスパラメータを実際のURLに埋め込む
        # path: '/api/webcoach/profile/{userid}'
        # path_parameters: {'userid': 123}
        # ↓
        url = self.path.format(**self.path_parameters)
        # url = '/api/webcoach/profile/123'

        # 2. クエリパラメータを追加
        # query: {'limit': 5, 'offset': 0}
        # ↓
        # url = '/api/webcoach/profile/123?limit=5&offset=0'

        # 3. 完全なURLを構築
        full_url = base_url + url
        # full_url = 'http://testserver/api/webcoach/profile/123'

        # 4. HTTPリクエストを送信
        import requests

        if self.method == 'GET':
            response = requests.get(
                full_url,
                headers=self.headers
            )
        elif self.method == 'POST':
            response = requests.post(
                full_url,
                json=self.body,
                headers=self.headers
            )

        return response
```

### 実際に送信されるリクエストの例:

```http
POST /api/webcoach/profile/123 HTTP/1.1
Host: testserver
Content-Type: application/json

{
  "self_intro": "テストユーザーです",
  "target_job": "エンジニア",
  "badge_count": 5
}
```

---

## 4. レスポンスの検証（Line 56）

```python
case.validate_response(response)
```

### `validate_response()` の内部動作:

```python
# Schemathesisの Case クラス内部（擬似コード）
class Case:
    def validate_response(self, response):
        # 1. ステータスコードの検証
        # swagger.yamlから許可されるステータスコードを取得
        allowed_status_codes = [200, 401, 403, 500]

        if response.status_code not in allowed_status_codes:
            raise ValidationError(
                f"Unexpected status code: {response.status_code}. "
                f"Expected one of: {allowed_status_codes}"
            )

        # 2. レスポンスボディの型チェック
        # swagger.yamlから期待されるContent-Typeを取得
        expected_content_type = 'application/json'
        actual_content_type = response.headers.get('Content-Type')

        if expected_content_type not in actual_content_type:
            raise ValidationError(
                f"Expected Content-Type: {expected_content_type}, "
                f"got: {actual_content_type}"
            )

        # 3. レスポンススキーマの検証
        if response.status_code == 200:
            # swagger.yamlから200レスポンスのスキーマを取得
            # responses:
            #   '200':
            #     content:
            #       application/json:
            #         schema:
            #           $ref: '#/components/schemas/Profile'

            expected_schema = {
                'type': 'object',
                'required': ['mdl_user_id'],
                'properties': {
                    'mdl_user_id': {'type': 'integer'},
                    'self_intro': {'type': 'string', 'nullable': True},
                    'target_job': {'type': 'string', 'nullable': True},
                    'badge_count': {'type': 'integer', 'nullable': True}
                }
            }

            response_data = response.json()

            # 必須フィールドのチェック
            if 'mdl_user_id' not in response_data:
                raise ValidationError("Required field 'mdl_user_id' is missing")

            # 各フィールドの型チェック
            if not isinstance(response_data['mdl_user_id'], int):
                raise ValidationError(
                    f"Field 'mdl_user_id' should be integer, "
                    f"got {type(response_data['mdl_user_id'])}"
                )

            if 'self_intro' in response_data:
                if response_data['self_intro'] is not None:
                    if not isinstance(response_data['self_intro'], str):
                        raise ValidationError(
                            "Field 'self_intro' should be string or null"
                        )

            # ... 他のフィールドも同様にチェック
```

---

## 5. Hypothesisによるプロパティベーステスト（Line 27）

```python
@settings(max_examples=10, deadline=None)
```

### `@settings` の動作:

```python
# Hypothesisライブラリの内部動作（擬似コード）

# max_examples=10 の場合、各テスト関数を10回実行
for i in range(10):
    # 毎回異なるランダムな値を生成
    case = generate_test_case(endpoint, method)

    # 生成される case の例:
    # 実行1回目:
    case1 = Case(
        path='/api/webcoach/profile/1',
        method='POST',
        body={'self_intro': 'test', 'badge_count': 5}
    )

    # 実行2回目:
    case2 = Case(
        path='/api/webcoach/profile/0',
        method='POST',
        body={'self_intro': None, 'target_job': 'a' * 256}
    )

    # 実行3回目:
    case3 = Case(
        path='/api/webcoach/profile/-1',
        method='POST',
        body={}
    )

    # ... 合計10パターン
```

---

## 6. フィルタリング（Line 49-50）

```python
if not any(case.path.startswith(path) for path in webcoach_paths):
    pytest.skip("Not an API server endpoint")
```

### この処理の目的:

```python
# swagger.yamlには多数のエンドポイントが定義されている:
# - /health
# - /api/health
# - /api/login
# - /api/logout
# - /api/moodle/courses
# - /api/webcoach/profile/{userid}    ← これだけテストしたい
# - /api/webcoach/resumecourse/{userid} ← これだけテストしたい

# api-serverのテストなので、WebCoach関連のみテスト
# それ以外はスキップ

# 内部動作:
if case.path == '/api/health':
    pytest.skip("Not an API server endpoint")  # スキップ

if case.path == '/api/webcoach/profile/123':
    # テスト実行
    pass
```

---

## 7. カスタム検証（Line 72-77）

```python
if response.status_code == 200:
    assert response.json() is not None
    data = response.json()
    if isinstance(data, dict):
        assert "mdl_user_id" in data or "error" in data
```

### Schemathesisの標準検証に加えて、独自の検証を追加:

```python
# Schemathesisの標準検証:
# ✓ ステータスコードが定義されたものか
# ✓ レスポンススキーマに準拠しているか
# ✓ 必須フィールドが存在するか

# 独自の検証（追加）:
# ✓ レスポンスがnullでないか
# ✓ 辞書型の場合、mdl_user_id または error フィールドが存在するか
```

---

## 8. フック（Line 138-158）

```python
@schema.hooks.register("before_call")
def before_call(context, case):
    # リクエスト送信前に実行される
    case.headers = case.headers or {}
    case.headers["X-Test-Mode"] = "true"
```

### フックの実行タイミング:

```python
# Schemathesis内部の処理フロー（擬似コード）

def run_test(case):
    # 1. before_call フックを実行
    for hook in registered_hooks['before_call']:
        hook(context, case)

    # この時点で case.headers に "X-Test-Mode": "true" が追加される

    # 2. リクエスト送信
    response = case.call(base_url="http://testserver")

    # 3. after_call フックを実行
    for hook in registered_hooks['after_call']:
        hook(context, case, response)

    # 4. レスポンス検証
    case.validate_response(response)
```

---

## まとめ: 処理の流れ

```
1. schema = schemathesis.from_path(SCHEMA_PATH)
   ↓ swagger.yamlを解析してエンドポイント情報を抽出

2. @schema.parametrize()
   ↓ 各エンドポイント × HTTPメソッドでテストケースを自動生成

3. Hypothesisが様々な入力パターンを生成
   ↓ パスパラメータ、クエリパラメータ、リクエストボディ

4. before_call フック実行
   ↓ 認証ヘッダなどを追加

5. case.call(base_url="http://testserver")
   ↓ HTTPリクエスト送信

6. after_call フック実行
   ↓ ログ記録など

7. case.validate_response(response)
   ↓ ステータスコード、Content-Type、スキーマを検証

8. 追加のカスタム検証
   ↓ assert文で独自のチェック

9. 次のテストケースへ（max_examples回繰り返す）
```

すべての処理はSchemathesisライブラリとHypothesisライブラリが自動的に行います。
開発者は swagger.yaml を用意するだけで、数千パターンのテストが自動生成されます。
