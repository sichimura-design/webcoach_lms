"""
AIアプリの表示用カラム（display_name / display_description）と app_key

- 一覧APIが表示用カラムと app_key（secret_key列の値）を返す
- 管理画面CSV（/api/updatedb）で表示用カラムを登録・更新できる
- 表示用カラムの列が無いCSVで更新しても、既存の値を消さない
- 空欄は NULL にする（画面側の既定文言へフォールバックさせるため）
"""
from entities.webcoach import WebCoachAIApplication


def _add_app(db, **kwargs):
    # SQLite は BigInteger の主キーを自動採番しないので id を明示する
    values = dict(
        id=db.query(WebCoachAIApplication).count() + 1,
        name="案件抽出メーカー（ココナラ）",
        category="案件サポート",
        description="ココナラの案件を探すAI",
        tags="AI,案件,ココナラ",
        secret_key="project-extractor-coconala",
    )
    values.update(kwargs)
    app = WebCoachAIApplication(**values)
    db.add(app)
    db.commit()
    return app


def _update(client, record):
    res = client.post("/api/updatedb", json={"data_type": "ai_applications", "records": [record]})
    assert res.status_code == 200, res.text
    assert res.json()["recordsFailed"] == 0, res.json()


def test_list_returns_display_columns_and_app_key(client, test_db):
    _add_app(test_db, display_name="ココナラで案件を探す", display_description="条件に合う案件を探します。")
    _add_app(test_db, name="ChatGPT", category="生成AI", description="対話型AI", tags=None, secret_key=None)

    res = client.get("/api/ai-applications", params={"limit": 100})

    assert res.status_code == 200
    apps = {a["name"]: a for a in res.json()["applications"]}
    coconala = apps["案件抽出メーカー（ココナラ）"]
    assert coconala["display_name"] == "ココナラで案件を探す"
    assert coconala["display_description"] == "条件に合う案件を探します。"
    assert coconala["app_key"] == "project-extractor-coconala"
    assert coconala["display_category"] is None
    assert coconala["sort_order"] is None
    assert coconala["tags"] == ["AI", "案件", "ココナラ"]
    # AIチャット連携の無い行は app_key が null（画面の一覧には出ない）
    assert apps["ChatGPT"]["app_key"] is None
    assert apps["ChatGPT"]["display_name"] is None


def test_updatedb_sets_display_columns(client, test_db):
    _add_app(test_db)

    _update(client, {
        "name": "案件抽出メーカー（ココナラ）",
        "category": "案件サポート",
        "description": "ココナラの案件を探すAI",
        "secret_key": "project-extractor-coconala",
        "display_name": "ココナラで案件を探す",
        "display_description": "条件に合う案件を探します。",
    })

    test_db.expire_all()
    app = test_db.query(WebCoachAIApplication).one()
    assert app.display_name == "ココナラで案件を探す"
    assert app.display_description == "条件に合う案件を探します。"


def test_updatedb_without_display_columns_keeps_existing_values(client, test_db):
    _add_app(test_db, display_name="ココナラで案件を探す", display_description="条件に合う案件を探します。")

    # 表示用カラムが無い（追加前の書式の）CSV
    _update(client, {
        "name": "案件抽出メーカー（ココナラ）",
        "category": "案件サポート",
        "description": "説明を更新",
        "secret_key": "project-extractor-coconala",
    })

    test_db.expire_all()
    app = test_db.query(WebCoachAIApplication).one()
    assert app.description == "説明を更新"
    assert app.display_name == "ココナラで案件を探す"
    assert app.display_description == "条件に合う案件を探します。"


def test_updatedb_blank_display_columns_become_null(client, test_db):
    _add_app(test_db, display_name="ココナラで案件を探す", display_description="条件に合う案件を探します。")

    _update(client, {
        "name": "案件抽出メーカー（ココナラ）",
        "category": "案件サポート",
        "description": "ココナラの案件を探すAI",
        "secret_key": "project-extractor-coconala",
        "display_name": "",
        "display_description": "",
    })

    test_db.expire_all()
    app = test_db.query(WebCoachAIApplication).one()
    assert app.display_name is None
    assert app.display_description is None


# ------------------------------------------------------------
# CSVでの削除（見出しは deleteFlag）
# ------------------------------------------------------------

def _post(client, records):
    res = client.post("/api/updatedb", json={"data_type": "ai_applications", "records": records})
    assert res.status_code == 200, res.text
    return res.json()


def test_updatedb_deletes_by_id_with_deleteflag(client, test_db):
    keep = _add_app(test_db, name="残すアプリ", secret_key=None)
    target = _add_app(test_db, name="消すアプリ", secret_key=None)

    # 管理画面のCSVそのままの形（値はすべて文字列、見出しは deleteFlag）
    body = _post(client, [{
        "id": str(target.id), "name": "消すアプリ", "category": "案件サポート",
        "description": "", "updateFlag": "0", "deleteFlag": "1",
    }])

    assert body["recordsFailed"] == 0, body
    test_db.expire_all()
    names = [a.name for a in test_db.query(WebCoachAIApplication).all()]
    assert names == [keep.name]


def test_updatedb_deletes_by_name_and_category_without_id(client, test_db):
    _add_app(test_db)

    body = _post(client, [{
        "id": "", "name": "案件抽出メーカー（ココナラ）", "category": "案件サポート", "deleteFlag": "1",
    }])

    assert body["recordsFailed"] == 0, body
    assert test_db.query(WebCoachAIApplication).count() == 0


def test_updatedb_delete_of_missing_row_is_reported(client, test_db):
    _add_app(test_db)

    body = _post(client, [{"id": "999", "name": "x", "category": "y", "deleteFlag": "1"}])

    assert body["recordsFailed"] == 1
    assert "999" in body["errors"][0]["message"]
    assert test_db.query(WebCoachAIApplication).count() == 1


def test_updatedb_deleteflag_zero_does_not_delete(client, test_db):
    app = _add_app(test_db)

    body = _post(client, [{
        "id": str(app.id), "name": app.name, "category": app.category,
        "description": "説明を更新", "secret_key": app.secret_key, "deleteFlag": "0",
    }])

    assert body["recordsFailed"] == 0, body
    test_db.expire_all()
    assert test_db.query(WebCoachAIApplication).one().description == "説明を更新"


def test_updatedb_updates_by_id_even_when_name_changes(client, test_db):
    app = _add_app(test_db)

    body = _post(client, [{
        "id": str(app.id), "name": "新しい名前", "category": app.category,
        "description": app.description, "secret_key": app.secret_key,
    }])

    assert body["recordsFailed"] == 0, body
    test_db.expire_all()
    rows = test_db.query(WebCoachAIApplication).all()
    assert [r.name for r in rows] == ["新しい名前"]  # 別の行として増えない


def test_updatedb_sets_category_and_sort_order(client, test_db):
    app = _add_app(test_db)

    body = _post(client, [{
        "id": str(app.id), "name": app.name, "category": app.category,
        "description": app.description, "secret_key": app.secret_key,
        "display_category": "案件獲得", "sort_order": "90",
    }])

    assert body["recordsFailed"] == 0, body
    res = client.get("/api/ai-applications", params={"limit": 100}).json()["applications"][0]
    assert res["display_category"] == "案件獲得"
    assert res["sort_order"] == 90


def test_updatedb_rejects_non_integer_sort_order(client, test_db):
    app = _add_app(test_db)

    body = _post(client, [{
        "id": str(app.id), "name": app.name, "category": app.category,
        "description": app.description, "sort_order": "先頭",
    }])

    assert body["recordsFailed"] == 1
    assert "sort_order" in body["errors"][0]["message"]
