"""
コーチ割り当ての解除(論理削除)の確認。
主キーに logical_deleted を含むため、同じ組み合わせを「解除→復元→解除」すると
削除済み行が重複して IntegrityError(=500) になっていた。
"""
from crud import (
    create_coach_student_mapping,
    delete_coach_student_mapping,
    restore_coach_student_mapping,
)
from entities.webcoach import WebCoachStudentCoachMapping


def _rows(db):
    return sorted(
        (m.coach_user_id, m.student_user_id, m.logical_deleted)
        for m in db.query(WebCoachStudentCoachMapping).all()
    )


def test_delete_twice_after_restore(test_db):
    create_coach_student_mapping(test_db, 1, 2)
    assert delete_coach_student_mapping(test_db, 1, 2) is True
    restore_coach_student_mapping(test_db, 1, 2)

    assert delete_coach_student_mapping(test_db, 1, 2) is True
    assert _rows(test_db) == [(1, 2, 1)]


def test_delete_without_active_mapping_returns_false(test_db):
    assert delete_coach_student_mapping(test_db, 1, 2) is False


def test_mapping_lifecycle_over_http(client):
    """CSV(manage-mappings)が叩く順: 登録→解除→復元→解除→再登録 がすべて通る"""
    base = "/api/coaching/mappings"
    assert client.post(base, json={"coach_user_id": 1, "student_user_id": 2}).status_code == 201
    assert client.post(base, json={"coach_user_id": 1, "student_user_id": 2}).status_code == 409
    assert client.delete(f"{base}/1/2").status_code == 204
    assert client.delete(f"{base}/1/2").status_code == 404
    assert client.post(f"{base}/1/2/restore").status_code == 200
    assert client.delete(f"{base}/1/2").status_code == 204
    assert client.post(base, json={"coach_user_id": 1, "student_user_id": 2}).status_code == 201

    active = client.get(base).json()
    assert [(m["coach_user_id"], m["student_user_id"]) for m in active] == [(1, 2)]
