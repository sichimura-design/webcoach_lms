"""
Smoke test for the coaching_schedule <-> next_coaching_goal linkage.

Covers the flow this change introduces:
- webcoach_coaching_schedule no longer has coaching_summary/todo
- webcoach_next_coaching_goal is keyed by (coaching_schedule_id, no)
- publishing a coaching note (status=published) splits client_next_actions
  (newline-separated) into next_coaching_goal rows
- ai_suggested / coach_confirmed must NOT leak into next_coaching_goal
"""
from datetime import date, datetime, timedelta

import crud
from entities.webcoach import WebCoachCoachingSchedule, WebCoachNextCoachingGoal, WebCoachCoachingNote

_next_id = [1]
_next_note_id = [1]


def _create_schedule(db, mdl_user_id=101, coach_user_id=201, coaching_no=1,
                     coaching_date=date(2026, 9, 20), status=None):
    # SQLiteのテストDBではBigInteger PKがrowid autoincrementのエイリアスに
    # ならずNULLのままINSERTされてしまうため、テストでは明示的にidを振る
    # （本番/UATのMySQLではAUTO_INCREMENTが効くのでcrud.create_coaching_scheduleで問題ない）。
    schedule = WebCoachCoachingSchedule(
        id=_next_id[0],
        mdl_user_id=mdl_user_id,
        coach_user_id=coach_user_id,
        coaching_no=coaching_no,
        coaching_date=coaching_date,
        status=status,
        meeting_url="https://meet.google.com/test",
        meeting_provider="google_meet",
    )
    _next_id[0] += 1
    db.add(schedule)
    db.flush()
    return schedule


def test_coaching_schedule_has_no_summary_or_todo_columns():
    columns = {c.name for c in WebCoachCoachingSchedule.__table__.columns}
    assert "coaching_summary" not in columns
    assert "todo" not in columns


def test_next_coaching_goal_primary_key_is_schedule_scoped():
    pk_cols = {c.name for c in WebCoachNextCoachingGoal.__table__.primary_key.columns}
    assert pk_cols == {"coaching_schedule_id", "no"}


def test_bulk_upsert_and_get_by_schedule(test_db):
    schedule = _create_schedule(test_db)
    test_db.commit()

    crud.bulk_upsert_next_coaching_goals(
        test_db,
        coaching_schedule_id=schedule.id,
        mdl_user_id=schedule.mdl_user_id,
        goals_data=[
            {"no": 1, "description": "A", "is_completed": 0},
            {"no": 2, "description": "B", "is_completed": 0},
        ],
    )
    test_db.commit()

    goals = crud.get_schedule_next_coaching_goals(test_db, schedule.id)
    assert [g.description for g in goals] == ["A", "B"]


def test_publish_note_syncs_next_coaching_goals(client, test_db):
    schedule = _create_schedule(test_db)
    test_db.commit()

    # AI下書き生成(LLM呼び出し)を避け、下書きノートを直接作成する。
    # crud.upsert_ai_coaching_note_draft相当だが、SQLiteテストDBでは
    # BigInteger PKがrowid autoincrementのエイリアスにならないため
    # idを明示的に振る（schedule同様、本番/UATのMySQLでは無関係）。
    note = WebCoachCoachingNote(
        id=_next_note_id[0],
        coaching_schedule_id=schedule.id,
        status="ai_suggested",
        session_summary="summary",
        client_next_actions="TypeScript第2章まで進める\nポートフォリオを完成させる",
    )
    _next_note_id[0] += 1
    test_db.add(note)
    test_db.commit()

    # coach_confirmed の段階ではまだ next_coaching_goal に反映されない
    resp = client.put(
        f"/api/coaching/notes/{schedule.id}",
        json={"status": "coach_confirmed"},
    )
    assert resp.status_code == 200, resp.text
    assert crud.get_schedule_next_coaching_goals(test_db, schedule.id) == []

    # published で初めて分割・反映される
    resp = client.put(
        f"/api/coaching/notes/{schedule.id}",
        json={"status": "published"},
    )
    assert resp.status_code == 200, resp.text

    goals = crud.get_schedule_next_coaching_goals(test_db, schedule.id)
    assert [g.description for g in goals] == [
        "TypeScript第2章まで進める",
        "ポートフォリオを完成させる",
    ]

    # 次回目標一覧APIが直近スケジュールの分を返す
    resp = client.get(f"/api/next-coaching-goals/{schedule.mdl_user_id}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert [g["description"] for g in body] == [
        "TypeScript第2章まで進める",
        "ポートフォリオを完成させる",
    ]
    assert all(g["coaching_schedule_id"] == schedule.id for g in body)


def test_next_coaching_goals_empty_when_no_schedule(client):
    resp = client.get("/api/next-coaching-goals/999999")
    assert resp.status_code == 200
    assert resp.json() == []


def test_bulk_upsert_endpoint_404_without_schedule(client):
    resp = client.put(
        "/api/next-coaching-goals/999999",
        json={"goals": [{"no": 1, "description": "x", "is_completed": 0}]},
    )
    assert resp.status_code == 404


def _today():
    # サーバ側の判定（JST）と揃える
    return datetime.now(crud.JST).date()


def _publish(client, test_db, schedule, actions):
    note = WebCoachCoachingNote(
        id=_next_note_id[0],
        coaching_schedule_id=schedule.id,
        status="coach_confirmed",
        session_summary="summary",
        client_next_actions="\n".join(actions),
    )
    _next_note_id[0] += 1
    test_db.add(note)
    test_db.commit()
    resp = client.put(f"/api/coaching/notes/{schedule.id}", json={"status": "published"})
    assert resp.status_code == 200, resp.text


def _descriptions(client, userid):
    resp = client.get(f"/api/next-coaching-goals/{userid}")
    assert resp.status_code == 200, resp.text
    return [g["description"] for g in resp.json()]


def test_future_schedule_does_not_hide_current_goals(client, test_db):
    """次回の予約（未来日）を登録しても、直近の実施済みの回のTODOが表示され続ける"""
    userid = 301
    past = _create_schedule(test_db, mdl_user_id=userid, coaching_no=1,
                            coaching_date=_today() - timedelta(days=7))
    test_db.commit()
    _publish(client, test_db, past, ["A", "B"])

    _create_schedule(test_db, mdl_user_id=userid, coaching_no=2,
                     coaching_date=_today() + timedelta(days=7))
    test_db.commit()

    assert _descriptions(client, userid) == ["A", "B"]

    # 完了チェックの保存先も実施済みの回
    resp = client.put(
        f"/api/next-coaching-goals/{userid}",
        json={"goals": [{"no": 1, "description": "A", "is_completed": 1},
                        {"no": 2, "description": "B", "is_completed": 0}]},
    )
    assert resp.status_code == 200, resp.text
    assert all(g["coaching_schedule_id"] == past.id for g in resp.json())


def test_rescheduled_and_unrecorded_today_are_skipped(client, test_db):
    """リスケ回・当日の未記録回（ノート未公開）は直近の回として扱わない"""
    userid = 302
    held = _create_schedule(test_db, mdl_user_id=userid, coaching_no=1,
                            coaching_date=_today() - timedelta(days=10))
    test_db.commit()
    _publish(client, test_db, held, ["A"])

    _create_schedule(test_db, mdl_user_id=userid, coaching_no=2,
                     coaching_date=_today() - timedelta(days=3), status="rescheduled")
    _create_schedule(test_db, mdl_user_id=userid, coaching_no=3, coaching_date=_today())
    test_db.commit()

    assert _descriptions(client, userid) == ["A"]


def test_publish_carries_over_incomplete_goals(client, test_db):
    """次の回のノートを公開すると、前回の未完了TODOが後ろに持ち越される"""
    userid = 303
    first = _create_schedule(test_db, mdl_user_id=userid, coaching_no=1,
                             coaching_date=_today() - timedelta(days=14))
    test_db.commit()
    _publish(client, test_db, first, ["done", "left", "same"])
    resp = client.put(
        f"/api/next-coaching-goals/{userid}",
        json={"goals": [{"no": 1, "description": "done", "is_completed": 1},
                        {"no": 2, "description": "left", "is_completed": 0},
                        {"no": 3, "description": "same", "is_completed": 0}]},
    )
    assert resp.status_code == 200, resp.text

    second = _create_schedule(test_db, mdl_user_id=userid, coaching_no=2, coaching_date=_today())
    test_db.commit()
    _publish(client, test_db, second, ["new", "same"])

    # 当日公開でも目標を持つので直近の回として表示される。完了済み・同じ文言は持ち越さない
    assert _descriptions(client, userid) == ["new", "same", "left"]
    goals = crud.get_schedule_next_coaching_goals(test_db, second.id)
    assert all(g.is_completed == 0 for g in goals)
    # 前回の行はそのまま残る
    assert len(crud.get_schedule_next_coaching_goals(test_db, first.id)) == 3
