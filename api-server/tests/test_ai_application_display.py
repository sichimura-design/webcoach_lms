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
