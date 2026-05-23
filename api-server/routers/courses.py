"""
Course access endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import CourseAccessCreate
from dto.response import CourseAccessResponse, LastAccessedCourse
import crud
from crud import get_image_url

router = APIRouter(prefix="/api", tags=["Course Access"])


@router.post(
    "/course-access",
    response_model=CourseAccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="コースアクセスを記録"
)
def record_course_access(
    data: CourseAccessCreate,
    db: Session = Depends(get_db)
):
    """
    ユーザーのコースアクセスを記録します。
    既存のレコードがある場合は、アクセス回数と最終アクセス時刻を更新します。

    Args:
        data: ユーザーIDとコースID

    Returns:
        作成または更新されたアクセス記録
    """
    try:
        result = crud.record_course_access(db, data)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record course access: {str(e)}"
        )


@router.get(
    "/users/{userid}/last-courses",
    response_model=List[LastAccessedCourse],
    summary="最終アクセスコース一覧を取得"
)
def get_last_accessed_courses(
    userid: int,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    ユーザーの最終アクセスコース一覧を取得します（新しい順）。

    Args:
        userid: ユーザーID
        limit: 取得件数（デフォルト: 10）

    Returns:
        最終アクセスコース一覧（コース情報付き）
    """
    try:
        courses = crud.get_user_last_accessed_courses(db, userid, limit)

        # 各コースに画像URLを追加
        result = []
        for course in courses:
            # コース画像URLを取得 (category_id=1 はコース)
            # courseは辞書形式
            courseid = course.get("courseid") if isinstance(course, dict) else course.courseid
            image_url = get_image_url(db, category_id=1, target_id=courseid)

            # courseが辞書の場合とオブジェクトの場合の両方に対応
            if isinstance(course, dict):
                course_dict = {
                    "id": course.get("id"),
                    "userid": course.get("userid"),
                    "courseid": course.get("courseid"),
                    "lastaccess": course.get("lastaccess"),
                    "accesscount": course.get("accesscount"),
                    "course_fullname": course.get("course_fullname"),
                    "course_shortname": course.get("course_shortname"),
                    "course_summary": course.get("course_summary"),
                    "image_url": image_url
                }
            else:
                course_dict = {
                    "id": course.id,
                    "userid": course.userid,
                    "courseid": course.courseid,
                    "lastaccess": course.lastaccess,
                    "accesscount": course.accesscount,
                    "course_fullname": course.course_fullname,
                    "course_shortname": course.course_shortname,
                    "course_summary": course.course_summary,
                    "image_url": image_url
                }
            result.append(LastAccessedCourse(**course_dict))

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get last accessed courses: {str(e)}"
        )


@router.get(
    "/users/{userid}/most-accessed-courses",
    response_model=List[dict],
    summary="最もアクセスの多いコース一覧を取得"
)
def get_most_accessed_courses(
    userid: int,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """
    ユーザーの最もアクセスの多いコース一覧を取得します。

    Args:
        userid: ユーザーID
        limit: 取得件数（デフォルト: 5）

    Returns:
        アクセス回数の多い順のコース一覧
    """
    try:
        courses = crud.get_most_accessed_courses(db, userid, limit)

        # 各コースに画像URLを追加
        for course in courses:
            # コース画像URLを取得 (category_id=1 はコース)
            image_url = get_image_url(db, category_id=1, target_id=course["courseid"])
            course["image_url"] = image_url

        return courses
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get most accessed courses: {str(e)}"
        )
