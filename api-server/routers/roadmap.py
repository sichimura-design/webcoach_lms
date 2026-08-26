"""
Career roadmap endpoints (フェーズ制・スキル別テンプレートの学習ロードマップ)

設計検討: docs/career-roadmap-table-design.md 参照
"""
from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from entities import WebCoachRoadmapPhase
from dto.request import UserRoadmapCreate, RoadmapProgressUpdate, RoadmapAnswerSubmit
from dto.response import (
    RoadmapSkillResponse,
    RoadmapPhaseResponse,
    UserRoadmapResponse,
    RoadmapProgressResponse,
    RoadmapQuestionResponse,
    RoadmapAnswerResponse,
)
from crud import (
    get_roadmap_skills,
    get_roadmap_phases,
    get_roadmap_phase_todos,
    create_user_roadmap,
    get_user_roadmap_detail,
    update_roadmap_progress,
    get_roadmap_questions,
    submit_roadmap_answers,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/roadmap", tags=["Career Roadmap"])


# ==========================================
# Skill / Phase Templates
# ==========================================

@router.get(
    "/skills",
    response_model=List[RoadmapSkillResponse],
    summary="ロードマップのスキル種別一覧取得"
)
def list_roadmap_skills(db: Session = Depends(get_db)):
    """
    ロードマップのスキル種別マスタ一覧を取得します（表示順）。
    """
    return get_roadmap_skills(db)


@router.get(
    "/phases",
    response_model=List[RoadmapPhaseResponse],
    summary="スキル別フェーズ・テンプレート一覧取得"
)
def list_roadmap_phases(skill_id: int, db: Session = Depends(get_db)):
    """
    指定スキルのフェーズ・テンプレート一覧を取得します（phase_no順、各フェーズのtodos付き）。

    Args:
        skill_id: 対象スキル(webcoach_roadmap_skill.id)
    """
    return get_roadmap_phases(db, skill_id)


# ==========================================
# User Roadmap
# ==========================================

@router.post(
    "/users/{userid}",
    response_model=UserRoadmapResponse,
    status_code=status.HTTP_201_CREATED,
    summary="ユーザーのロードマップ開始"
)
def start_user_roadmap(
    userid: int,
    request: UserRoadmapCreate,
    db: Session = Depends(get_db)
):
    """
    ユーザーのロードマップを新規開始します。
    スキルの全フェーズ分の進捗行を自動シードし、最初のフェーズをin_progressにします。

    Args:
        userid: 受講生のMoodleユーザーID
        request: 開始するスキルID
    """
    try:
        create_user_roadmap(db, mdl_user_id=userid, skill_id=request.skill_id)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to start user roadmap: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start roadmap"
        )

    detail = get_user_roadmap_detail(db, userid)
    return detail


@router.get(
    "/users/{userid}",
    response_model=UserRoadmapResponse,
    summary="ユーザーの現在のロードマップ取得"
)
def get_user_roadmap(userid: int, db: Session = Depends(get_db)):
    """
    ユーザーの現在アクティブな（未完了の）ロードマップを、スキル・全フェーズ進捗・
    各フェーズのtodos・目標期限（最終フェーズの期日）まで含めて取得します。

    Args:
        userid: 受講生のMoodleユーザーID
    """
    detail = get_user_roadmap_detail(db, userid)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active roadmap not found for user {userid}"
        )
    return detail


@router.put(
    "/progress/{progress_id}",
    response_model=RoadmapProgressResponse,
    summary="フェーズ進捗の更新"
)
def update_progress(
    progress_id: int,
    request: RoadmapProgressUpdate,
    db: Session = Depends(get_db)
):
    """
    フェーズ進捗を更新します（コーチによる期日修正・ステータス変更）。
    statusを'completed'にすると、次フェーズが未着手であれば自動的にin_progressへ進みます。

    Args:
        progress_id: 更新対象(webcoach_roadmap_progress.id)
        request: 更新内容
    """
    try:
        progress = update_roadmap_progress(
            db,
            progress_id=progress_id,
            status=request.status,
            start=request.start,
            end=request.end,
            updated_by=request.updated_by,
        )
        if not progress:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap progress not found: id={progress_id}"
            )
        db.commit()
        db.refresh(progress)
        # レスポンスにフェーズ・テンプレートを埋め込むため再取得
        phase = db.query(WebCoachRoadmapPhase).filter(
            WebCoachRoadmapPhase.id == progress.phase_id
        ).first()
        phase.todos = get_roadmap_phase_todos(db, phase.id)
        progress.phase = phase
        return progress
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update roadmap progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update roadmap progress"
        )


# ==========================================
# Review Questions / Answers
# ==========================================

@router.get(
    "/questions/{review_no}",
    response_model=List[RoadmapQuestionResponse],
    summary="見直し用の固定質問取得"
)
def list_roadmap_questions(review_no: int, db: Session = Depends(get_db)):
    """
    指定回の見直し用固定質問を取得します（question_no順）。全ユーザー・全スキル共通です。

    Args:
        review_no: n回目の質問か
    """
    return get_roadmap_questions(db, review_no)


@router.post(
    "/users/{userid}/answers",
    response_model=List[RoadmapAnswerResponse],
    summary="見直し質問への回答登録"
)
def submit_answers(
    userid: int,
    request: RoadmapAnswerSubmit,
    db: Session = Depends(get_db)
):
    """
    見直し質問への回答をまとめて登録/更新します。

    Args:
        userid: 受講生のMoodleユーザーID
        request: review_noと回答一覧
    """
    try:
        answers = submit_roadmap_answers(
            db,
            mdl_user_id=userid,
            review_no=request.review_no,
            answers=[item.model_dump() for item in request.answers],
        )
        db.commit()
        for answer in answers:
            db.refresh(answer)
        return answers
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to submit roadmap answers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit answers"
        )
