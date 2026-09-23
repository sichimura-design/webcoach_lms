"""
Tests for get_roadmap_progress_owner — used by the BFF to verify a coach is
actually assigned to the student who owns a roadmap progress record before
allowing PUT /api/roadmap/progress/:id (security fix, see plan
harmonic-crunching-karp.md).
"""
from entities.webcoach import WebCoachUserRoadmap, WebCoachRoadmapProgress
from crud import get_roadmap_progress_owner


def _make_progress(test_db, mdl_user_id, user_roadmap_id, progress_id, phase_id=1):
    # SQLite (used by the test_db fixture) doesn't auto-assign BigInteger
    # primary keys the way MySQL does, so ids are set explicitly here.
    user_roadmap = WebCoachUserRoadmap(
        id=user_roadmap_id, mdl_user_id=mdl_user_id, skill_id=1, is_completed=0
    )
    test_db.add(user_roadmap)
    test_db.flush()

    progress = WebCoachRoadmapProgress(
        id=progress_id,
        user_roadmap_id=user_roadmap.id,
        phase_id=phase_id,
        status="not_started",
    )
    test_db.add(progress)
    test_db.flush()
    return progress.id


class TestGetRoadmapProgressOwner:
    def test_returns_owning_user_id(self, test_db):
        progress_id = _make_progress(test_db, mdl_user_id=42, user_roadmap_id=1, progress_id=1)

        owner = get_roadmap_progress_owner(test_db, progress_id)

        assert owner == 42

    def test_returns_none_for_missing_progress(self, test_db):
        owner = get_roadmap_progress_owner(test_db, progress_id=999999)

        assert owner is None

    def test_distinguishes_between_students(self, test_db):
        progress_id_a = _make_progress(test_db, mdl_user_id=1, user_roadmap_id=1, progress_id=1)
        progress_id_b = _make_progress(test_db, mdl_user_id=2, user_roadmap_id=2, progress_id=2)

        assert get_roadmap_progress_owner(test_db, progress_id_a) == 1
        assert get_roadmap_progress_owner(test_db, progress_id_b) == 2
