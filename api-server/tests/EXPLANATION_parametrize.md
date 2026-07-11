# @schema.parametrize() の動作説明

## 質問: 「この1行で全エンドポイントのテストが自動生成される」は本当か？

**答え: はい、本当です。ただし正確には以下の通りです。**

---

## 実際の動作

### test_api_schemathesis.py のコード

```python
schema = schemathesis.from_path(SCHEMA_PATH)  # ← swagger.yaml を読み込む

@schema.parametrize()  # ← この1行で全エンドポイントのテストケースを生成
@settings(max_examples=10)
def test_api_endpoints(case, schema_test_client):
    response = case.call(base_url="http://testserver")
    case.validate_response(response)
```

### 何が起きているか

1. **swagger.yaml を解析**
   ```
   swagger.yaml には 25個以上のエンドポイントが定義されている:
   - GET  /health
   - GET  /api/health
   - POST /api/login
   - POST /api/logout
   - GET  /api/webcoach/profile/{userid}
   - POST /api/webcoach/profile/{userid}
   - ... など
   ```

2. **@schema.parametrize() が全エンドポイントを抽出**
   ```python
   # Schemathesis が内部で以下のようなリストを生成（擬似コード）
   test_cases = [
       Case(method='GET', path='/health'),
       Case(method='GET', path='/api/health'),
       Case(method='POST', path='/api/login'),
       Case(method='POST', path='/api/logout'),
       Case(method='GET', path='/api/webcoach/profile/1'),
       Case(method='GET', path='/api/webcoach/profile/123'),
       Case(method='POST', path='/api/webcoach/profile/1'),
       Case(method='POST', path='/api/webcoach/profile/123'),
       # ... 25個以上 × max_examples(10) = 250個以上
   ]
   ```

3. **各ケースに対して test_api_endpoints() を実行**
   ```python
   # pytest 実行時の内部動作（擬似コード）
   for case in test_cases:
       test_api_endpoints(case, schema_test_client)
   ```

---

## pytest 実行時の出力イメージ

```bash
$ pytest tests/test_api_schemathesis.py::test_api_endpoints -v
```

**出力:**
```
tests/test_api_schemathesis.py::test_api_endpoints[GET /health] PASSED
tests/test_api_schemathesis.py::test_api_endpoints[GET /api/health] SKIPPED
tests/test_api_schemathesis.py::test_api_endpoints[POST /api/login] SKIPPED
tests/test_api_schemathesis.py::test_api_endpoints[POST /api/logout] SKIPPED
tests/test_api_schemathesis.py::test_api_endpoints[GET /api/moodle/courses] SKIPPED
tests/test_api_schemathesis.py::test_api_endpoints[GET /api/webcoach/profile/1] PASSED
tests/test_api_schemathesis.py::test_api_endpoints[GET /api/webcoach/profile/0] PASSED
tests/test_api_schemathesis.py::test_api_endpoints[POST /api/webcoach/profile/1] PASSED
tests/test_api_schemathesis.py::test_api_endpoints[POST /api/webcoach/resumecourse/1] PASSED
... 合計 250個以上のテストが実行される
```

**注目ポイント:**
- **同じ関数** `test_api_endpoints` が複数回実行されている
- 各実行で **異なるパラメータ** (異なる case) が渡されている
- これが **pytest のパラメトライズ機能**

---

## @schema.parametrize() vs 手動テスト

### 手動で書く場合（従来の方法）

```python
# 各エンドポイントごとに関数を書く必要がある

def test_health():
    response = client.get("/health")
    assert response.status_code == 200

def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200

def test_login():
    response = client.post("/api/login", json={...})
    assert response.status_code == 200

def test_logout():
    response = client.post("/api/logout")
    assert response.status_code == 200

def test_get_profile_user1():
    response = client.get("/api/webcoach/profile/1")
    assert response.status_code == 200

def test_get_profile_user999():
    response = client.get("/api/webcoach/profile/999")
    assert response.status_code == 200

# ... 250個の関数を書く必要がある！
```

**問題点:**
- ❌ 250個のテスト関数を手動で書く必要がある
- ❌ 新しいエンドポイントが追加されるたびに手動追加
- ❌ コードの重複が多い
- ❌ メンテナンスが大変

---

### @schema.parametrize() を使う場合

```python
@schema.parametrize()
@settings(max_examples=10)
def test_api_endpoints(case):
    response = case.call(base_url="http://testserver")
    case.validate_response(response)
```

**たった4行で250個のテストが実行される！**

**メリット:**
- ✅ 1つの関数定義で全エンドポイントをテスト
- ✅ swagger.yaml に新しいエンドポイントを追加すれば自動的にテスト対象に
- ✅ コードの重複なし
- ✅ メンテナンスが楽

---

## フィルタリングについて

### なぜフィルタリングが必要か？

swagger.yaml には **BFFサーバーのエンドポイント** も含まれている:

```yaml
# swagger.yaml
paths:
  /api/login:         # ← BFFサーバー専用
  /api/logout:        # ← BFFサーバー専用
  /api/moodle/courses: # ← BFFサーバー専用
  /api/webcoach/profile/{userid}: # ← api-server にも存在
```

**問題:**
- api-server をテストしたいが、swagger.yaml には BFF のエンドポイントも含まれている
- BFF のエンドポイントは api-server には存在しない
- 存在しないエンドポイントをテストするとエラーになる

**解決策: フィルタリング**

```python
@schema.parametrize()
def test_api_endpoints(case):
    # api-server に存在するエンドポイントのみテスト
    webcoach_paths = [
        "/api/webcoach/profile/",
        "/api/webcoach/resumecourse/",
        # ...
    ]

    if not any(case.path.startswith(path) for path in webcoach_paths):
        pytest.skip("Not an API server endpoint")  # ← スキップ

    # ここに到達するのは /api/webcoach/* のみ
    response = case.call(base_url="http://testserver")
    case.validate_response(response)
```

**動作:**
```
test_api_endpoints[GET /health] → SKIPPED (BFFのエンドポイント)
test_api_endpoints[POST /api/login] → SKIPPED (BFFのエンドポイント)
test_api_endpoints[GET /api/webcoach/profile/1] → PASSED (api-serverのエンドポイント)
test_api_endpoints[POST /api/webcoach/profile/1] → PASSED (api-serverのエンドポイント)
```

---

## 具体的な実行回数の計算

### test_api_endpoints の実行回数

```python
@schema.parametrize()
@settings(max_examples=10, deadline=None)
def test_api_endpoints(case, schema_test_client):
    ...
```

**計算:**
```
swagger.yaml のエンドポイント数: 約25個
各エンドポイントで生成されるパターン数: 10個 (max_examples=10)

総実行回数 = 25 × 10 = 250回

ただし、フィルタリングで api-server 関連のみに絞ると:
api-server のエンドポイント数: 約10個
実際の実行回数 = 10 × 10 = 100回
残りの 150回 は SKIPPED
```

---

## まとめ

### 「この1行で全エンドポイントのテストが自動生成される」は本当か？

✅ **本当です！**

正確には:
1. `@schema.parametrize()` が swagger.yaml から全エンドポイントを抽出
2. 各エンドポイント × HTTPメソッド × 入力パターン のテストケースを自動生成
3. 1つの関数定義で数百個のテストが実行される
4. フィルタリングで必要なテストのみ実行することも可能

### 開発者がやること

```python
# たった3ステップ
1. schema = schemathesis.from_path("swagger.yaml")  # スキーマ読み込み
2. @schema.parametrize()                             # 全エンドポイントのテスト生成
3. def test_func(case): ...                          # テストロジック記述
```

### Schemathesis がやること

```
✓ swagger.yaml の解析
✓ 全エンドポイントの抽出
✓ 数百パターンの入力データ生成
✓ HTTPリクエスト送信
✓ レスポンススキーマ検証
✓ 境界値テスト
✓ エラーケーステスト
```

**結論: 数行のコードで数百個のテストが自動実行される = 超効率的！**
