"""
crud.get_active_study_session のテスト。

mdl_logstore_standard_log はMoodle本体のテーブルなので、必要な列だけのテーブルを
SQLiteのインメモリDBに作って実際のSQLを流す(判定はSQLの順序条件そのものなのでモックしない)。
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import crud

STARTED = crud._STUDY_STARTED_EVENT
ENDED = crud._STUDY_ENDED_EVENT


def _db(events):
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE mdl_logstore_standard_log ("
            "id INTEGER PRIMARY KEY, userid INTEGER, courseid INTEGER, eventname TEXT, timecreated INTEGER)"
        ))
        for i, (eventname, ts, courseid) in enumerate(events, start=1):
            conn.execute(
                text("INSERT INTO mdl_logstore_standard_log VALUES (:id, 1, :c, :e, :t)"),
                {"id": i, "c": courseid, "e": eventname, "t": ts},
            )
    return sessionmaker(bind=engine)()


def test_course_switch_in_same_second_is_still_active():
    """教材の切り替え(前の教材のended→次の教材のstarted)が同じ秒でも、計測中と判定する"""
    db = _db([(STARTED, 1000, 10), (ENDED, 1600, 10), (STARTED, 1600, 20)])
    active = crud.get_active_study_session(db, 1)
    assert active is not None
    assert active["courseid"] == 20


def test_ended_after_start_in_same_second_is_not_active():
    """同じ秒でも started の後に ended があれば終了済み"""
    db = _db([(STARTED, 1000, 10), (ENDED, 1000, 10)])
    assert crud.get_active_study_session(db, 1) is None


def test_ended_later_is_not_active():
    db = _db([(STARTED, 1000, 10), (ENDED, 1300, 10)])
    assert crud.get_active_study_session(db, 1) is None


def test_no_start_is_not_active():
    assert crud.get_active_study_session(_db([]), 1) is None
