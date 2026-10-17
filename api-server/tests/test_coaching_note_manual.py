"""
AIの下書きが届かなかった回に、コーチが手で記録を書けることと、
コーチの記録が後から届いたAIの下書きで上書きされないことのテスト。

- 手で書けるのは自動作成が失敗した回だけ（予約日が過ぎ、文字起こしが無いか取り込みから1時間たった）
- PUT /api/coaching/notes/{id} はその回に限りノートを作る（status=coach_confirmed）、それ以外は409
- GET の404に manual_allowed を載せる
- 公開すると、手で書いた「次回までのアクション」も次回TODOになる
- coach_confirmed / published のノートがある回は、AIを呼ばず上書きもしない
- ai_suggested（コーチ未確認）の下書きは、作り直しで上書きしてよい
"""
from datetime import date, datetime, timedelta
from unittest.mock import patch

from sqlalchemy.orm import sessionmaker

import crud
from entities.webcoach import (
    WebCoachCoachingSchedule, WebCoachCoachingNote, WebCoachNextCoachingGoal, WebCoachCoachingRecording,
)
from routers import notes

ENTRIES = {"transcript_entries": [{"speaker": "coach", "text": "今日は職務経歴書を見ます", "timestamp": None}]}

_next_id = [5000]


def _id():
    _next_id[0] += 1
    return _next_id[0]


YESTERDAY = datetime.now(crud.JST).date() - timedelta(days=1)


def _add_schedule(db, coaching_date=YESTERDAY, status=None):
    # SQLiteのテストDBではBigInteger PKが自動採番されないため明示的にidを振る
    schedule = WebCoachCoachingSchedule(
        id=_id(), mdl_user_id=301, coach_user_id=401, coaching_no=_next_id[0], status=status,
        coaching_date=coaching_date, meeting_url="https://meet.google.com/test", meeting_provider="google_meet",
    )
    db.add(schedule)
    db.flush()
    return schedule


def _add_note(db, schedule_id, status, summary="コーチが書いた概要"):
    note = WebCoachCoachingNote(id=_id(), coaching_schedule_id=schedule_id, status=status, session_summary=summary)
    db.add(note)
    db.flush()
    return note


def _create_with_id(db, coaching_schedule_id):
    """crud.create_coach_coaching_note と同じ内容で、SQLite用にidを振る"""
    return _add_note(db, coaching_schedule_id, "coach_confirmed", summary=None)


def test_put_creates_a_note_when_none_exists_and_publish_makes_todos(client, test_db):
    schedule = _add_schedule(test_db)
    test_db.commit()

    with patch.object(notes, "create_coach_coaching_note", side_effect=_create_with_id), \
            patch.object(crud, "_incomplete_goals_before", return_value=[]):
        draft = client.put(f"/api/coaching/notes/{schedule.id}", json={"session_summary": "文字起こし無しの回"})
        assert draft.status_code == 200
        assert draft.json()["status"] == "coach_confirmed"
        assert draft.json()["session_summary"] == "文字起こし無しの回"

        published = client.put(
            f"/api/coaching/notes/{schedule.id}",
            json={"status": "published", "client_next_actions": "職務経歴書を直す\n求人を3件探す"},
        )

    assert published.status_code == 200
    assert published.json()["status"] == "published"
    test_db.expire_all()
    assert test_db.query(WebCoachCoachingNote).filter_by(coaching_schedule_id=schedule.id).count() == 1
    goals = test_db.query(WebCoachNextCoachingGoal).filter_by(coaching_schedule_id=schedule.id) \
        .order_by(WebCoachNextCoachingGoal.display_order).all()
    assert [g.description for g in goals] == ["職務経歴書を直す", "求人を3件探す"]


def test_create_coach_coaching_note_is_coach_confirmed():
    class FakeDb:
        def add(self, obj):
            self.added = obj

        def flush(self):
            pass

    db = FakeDb()
    note = crud.create_coach_coaching_note(db, coaching_schedule_id=1)
    assert note is db.added
    assert note.status == "coach_confirmed"


def _run_inline(test_db):
    factory = sessionmaker(bind=test_db.get_bind())
    return (
        patch.object(notes, "_start_background", side_effect=lambda target, *args: target(*args)),
        patch.object(notes, "SessionLocal", factory),
    )


def test_generate_skips_when_the_coach_already_wrote_the_note(client, test_db):
    for status in ("coach_confirmed", "published"):
        schedule = _add_schedule(test_db)
        _add_note(test_db, schedule.id, status)
        test_db.commit()
        start_patch, session_patch = _run_inline(test_db)

        with start_patch, session_patch, patch.object(notes, "generate_coaching_note_draft") as generate:
            res = client.post(f"/api/coaching/notes/{schedule.id}/generate", json=ENTRIES)

        assert res.status_code == 202
        generate.assert_not_called()
        test_db.expire_all()
        note = test_db.query(WebCoachCoachingNote).filter_by(coaching_schedule_id=schedule.id).one()
        assert (note.status, note.session_summary) == (status, "コーチが書いた概要")
        assert schedule.id not in notes._generating_schedule_ids


def test_ai_draft_upsert_keeps_coach_notes_but_replaces_ai_drafts(test_db):
    confirmed = _add_schedule(test_db)
    _add_note(test_db, confirmed.id, "coach_confirmed")
    suggested = _add_schedule(test_db)
    _add_note(test_db, suggested.id, "ai_suggested", summary="古いAI下書き")
    test_db.commit()

    crud.upsert_ai_coaching_note_draft(test_db, coaching_schedule_id=confirmed.id, session_summary="AI")
    crud.upsert_ai_coaching_note_draft(test_db, coaching_schedule_id=suggested.id, session_summary="新しいAI下書き")

    test_db.expire_all()
    get = lambda s: test_db.query(WebCoachCoachingNote).filter_by(coaching_schedule_id=s.id).one().session_summary
    assert get(confirmed) == "コーチが書いた概要"
    assert get(suggested) == "新しいAI下書き"


def _add_transcript(db, schedule_id, minutes_ago):
    # SQLiteの CURRENT_TIMESTAMP はUTCなので、updated_at もUTCで入れる
    db.add(WebCoachCoachingRecording(
        id=_id(), coaching_schedule_id=schedule_id, recording_type="transcript", source="google_meet",
        s3_bucket="b", s3_key="k", status="completed",
        updated_at=datetime.utcnow() - timedelta(minutes=minutes_ago),
    ))
    db.flush()


def test_manual_note_only_when_generation_missed(test_db):
    today = datetime.now(crud.JST).date()
    cases = {
        "当日はまだ待つ": (_add_schedule(test_db, coaching_date=today), None, False),
        "文字起こし無しで翌日": (_add_schedule(test_db), None, True),
        "取り込み直後はAI作成中": (_add_schedule(test_db), 10, False),
        "取り込みから1時間超": (_add_schedule(test_db), 90, True),
        "リスケの回": (_add_schedule(test_db, status="rescheduled"), None, False),
    }
    for schedule, minutes_ago, _ in cases.values():
        if minutes_ago is not None:
            _add_transcript(test_db, schedule.id, minutes_ago)
    with_note = _add_schedule(test_db)
    _add_note(test_db, with_note.id, "ai_suggested")
    test_db.commit()

    got = {name: crud.is_coaching_note_missed(test_db, s) for name, (s, _, _) in cases.items()}
    assert got == {name: expected for name, (_, _, expected) in cases.items()}
    assert crud.is_coaching_note_missed(test_db, with_note) is False


def test_put_without_note_is_rejected_while_ai_may_still_come(client, test_db):
    schedule = _add_schedule(test_db, coaching_date=datetime.now(crud.JST).date())
    test_db.commit()

    res = client.put(f"/api/coaching/notes/{schedule.id}", json={"session_summary": "早すぎる"})

    assert res.status_code == 409
    assert test_db.query(WebCoachCoachingNote).filter_by(coaching_schedule_id=schedule.id).count() == 0


def test_get_404_tells_whether_manual_note_is_allowed(client, test_db):
    missed = _add_schedule(test_db)
    waiting = _add_schedule(test_db, coaching_date=datetime.now(crud.JST).date())
    test_db.commit()

    assert client.get(f"/api/coaching/notes/{missed.id}").json()["manual_allowed"] is True
    res = client.get(f"/api/coaching/notes/{waiting.id}")
    assert res.status_code == 404
    assert res.json()["manual_allowed"] is False
