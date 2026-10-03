"""
AIコーチングノート生成の非同期化と、作り直し対象の取得のテスト。

- POST /api/coaching/notes/{id}/generate は202ですぐ返し、生成・保存はバックグラウンドで行う
- 同じ回を生成中なら二重に生成しない（already_running）
- 生成に失敗するとノートは保存されず、GET /pending-generation に残る（定期同期処理が作り直す）
"""
import json
from datetime import date, timedelta
from unittest.mock import patch

from sqlalchemy.orm import sessionmaker

from entities.webcoach import WebCoachCoachingSchedule, WebCoachCoachingRecording, WebCoachCoachingNote
from routers import notes

ENTRIES = {"transcript_entries": [{"speaker": "coach", "text": "今日は職務経歴書を見ます", "timestamp": None}]}
DRAFT = {
    "session_summary": "職務経歴書の確認",
    "client_status_and_goal": None,
    "main_issues": None,
    "coach_feedback": None,
    "decisions": None,
    "client_next_actions": "ドラフトを直す",
    "coach_follow_up": None,
    "next_session_check": None,
}

_next_id = [1000]


def _add_schedule(db, coaching_date=None):
    # SQLiteのテストDBではBigInteger PKが自動採番されないため明示的にidを振る
    schedule = WebCoachCoachingSchedule(
        id=_next_id[0],
        mdl_user_id=101,
        coach_user_id=201,
        coaching_no=_next_id[0],  # (受講生, コーチ, 回数)が一意なので回ごとに変える
        coaching_date=coaching_date or date.today(),
        meeting_url="https://meet.google.com/test",
        meeting_provider="google_meet",
    )
    _next_id[0] += 1
    db.add(schedule)
    db.flush()
    return schedule


def _add_transcript(db, schedule_id, status="completed"):
    recording = WebCoachCoachingRecording(
        id=_next_id[0],
        coaching_schedule_id=schedule_id,
        recording_type="transcript",
        source="google_meet",
        s3_bucket="bucket",
        s3_key=f"coaching-transcripts/{schedule_id}/t.json",
        status=status,
    )
    _next_id[0] += 1
    db.add(recording)
    db.flush()
    return recording


def _run_inline(test_db):
    """バックグラウンドスレッドの代わりにその場で実行し、テスト用DBセッションを使わせる"""
    factory = sessionmaker(bind=test_db.get_bind())
    return (
        patch.object(notes, "_start_background", side_effect=lambda target, *args: target(*args)),
        patch.object(notes, "SessionLocal", factory),
    )


def test_generate_returns_202_and_saves_note_in_background(client, test_db):
    schedule = _add_schedule(test_db)
    test_db.commit()
    start_patch, session_patch = _run_inline(test_db)

    def save_with_id(db, coaching_schedule_id, **fields):
        # SQLiteのテストDBではノートのBigInteger PKが自動採番されないため、idを振って保存する
        db.add(WebCoachCoachingNote(id=_next_id[0], coaching_schedule_id=coaching_schedule_id, **fields))
        _next_id[0] += 1
        db.commit()

    with start_patch, session_patch, \
            patch.object(notes, "generate_coaching_note_draft", return_value=DRAFT), \
            patch.object(notes, "upsert_ai_coaching_note_draft", side_effect=save_with_id):
        res = client.post(f"/api/coaching/notes/{schedule.id}/generate", json=ENTRIES)

    assert res.status_code == 202
    assert res.json() == {"coaching_schedule_id": schedule.id, "status": "started"}
    test_db.expire_all()
    note = test_db.query(WebCoachCoachingNote).filter_by(coaching_schedule_id=schedule.id).one()
    assert note.session_summary == "職務経歴書の確認"
    assert schedule.id not in notes._generating_schedule_ids


def test_generate_does_not_start_twice_for_same_schedule(client, test_db):
    schedule = _add_schedule(test_db)
    test_db.commit()

    with patch.object(notes, "_start_background") as start:
        first = client.post(f"/api/coaching/notes/{schedule.id}/generate", json=ENTRIES)
        second = client.post(f"/api/coaching/notes/{schedule.id}/generate", json=ENTRIES)

    try:
        assert first.json()["status"] == "started"
        assert second.status_code == 202
        assert second.json()["status"] == "already_running"
        assert start.call_count == 1
    finally:
        notes._generating_schedule_ids.discard(schedule.id)


def test_generation_failure_saves_nothing_and_allows_retry(client, test_db):
    schedule = _add_schedule(test_db)
    test_db.commit()
    start_patch, session_patch = _run_inline(test_db)

    with start_patch, session_patch, patch.object(
        notes, "generate_coaching_note_draft", side_effect=json.JSONDecodeError("bad", "", 0)
    ):
        res = client.post(f"/api/coaching/notes/{schedule.id}/generate", json=ENTRIES)

    assert res.status_code == 202
    test_db.expire_all()
    assert test_db.query(WebCoachCoachingNote).filter_by(coaching_schedule_id=schedule.id).count() == 0
    # 生成中の印は外れているので、次の依頼でまた生成できる
    assert schedule.id not in notes._generating_schedule_ids


def test_generate_rejects_empty_transcript(client, test_db):
    schedule = _add_schedule(test_db)
    test_db.commit()

    with patch.object(notes, "_start_background") as start:
        res = client.post(f"/api/coaching/notes/{schedule.id}/generate", json={"transcript_entries": []})

    assert res.status_code == 400
    start.assert_not_called()


def test_pending_generation_lists_transcripts_without_note(client, test_db):
    no_note = _add_schedule(test_db)
    _add_transcript(test_db, no_note.id)

    with_note = _add_schedule(test_db)
    _add_transcript(test_db, with_note.id)
    test_db.add(WebCoachCoachingNote(id=_next_id[0], coaching_schedule_id=with_note.id, status="ai_suggested"))
    _next_id[0] += 1

    too_old = _add_schedule(test_db, coaching_date=date.today() - timedelta(days=31))
    _add_transcript(test_db, too_old.id)

    not_completed = _add_schedule(test_db)
    _add_transcript(test_db, not_completed.id, status="failed")

    no_transcript = _add_schedule(test_db)
    test_db.commit()

    res = client.get("/api/coaching/notes/pending-generation")

    assert res.status_code == 200
    assert res.json() == [{
        "coaching_schedule_id": no_note.id,
        "s3_bucket": "bucket",
        "s3_key": f"coaching-transcripts/{no_note.id}/t.json",
    }]
    assert no_transcript.id not in {r["coaching_schedule_id"] for r in res.json()}
