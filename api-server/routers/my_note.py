"""
My Note endpoints

教材に紐づかない自由記述のマイノート機能。フォルダは入れ子対応。
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import MyNoteFolderCreate, MyNoteFolderUpdate, MyNoteCreate, MyNoteUpdate
from dto.response import MyNoteFolderResponse, MyNoteResponse
from crud import (
    create_my_note_folder,
    list_my_note_folders,
    update_my_note_folder,
    delete_my_note_folder,
    create_my_note,
    get_my_note,
    list_my_notes,
    update_my_note,
    delete_my_note,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/my-note", tags=["My Note"])


# ==========================================
# Folder Endpoints
# ==========================================

@router.get(
    "/folders/{userid}",
    response_model=List[MyNoteFolderResponse],
    summary="マイノートフォルダ一覧取得"
)
def list_folders(userid: int, db: Session = Depends(get_db)):
    """
    ユーザーのマイノートフォルダをフラットな一覧で返します。
    ツリー構造への組み立て（parent_folder_idによる）はフロント側で行います。
    """
    return list_my_note_folders(db, userid)


@router.post(
    "/folders/{userid}",
    response_model=MyNoteFolderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="マイノートフォルダ作成"
)
def create_folder(userid: int, data: MyNoteFolderCreate, db: Session = Depends(get_db)):
    try:
        folder = create_my_note_folder(
            db,
            mdl_user_id=userid,
            name=data.name,
            parent_folder_id=data.parent_folder_id,
        )
        db.commit()
        db.refresh(folder)
        return folder
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put(
    "/folders/{userid}/{folder_id}",
    response_model=MyNoteFolderResponse,
    summary="マイノートフォルダ更新（リネーム・移動）"
)
def update_folder(userid: int, folder_id: int, data: MyNoteFolderUpdate, db: Session = Depends(get_db)):
    try:
        folder = update_my_note_folder(
            db,
            mdl_user_id=userid,
            folder_id=folder_id,
            name=data.name,
            parent_folder_id=data.parent_folder_id,
            parent_folder_id_provided="parent_folder_id" in data.model_fields_set,
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"My note folder not found: folder_id={folder_id}"
        )

    db.commit()
    db.refresh(folder)
    return folder


@router.delete(
    "/folders/{userid}/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="マイノートフォルダ削除"
)
def delete_folder(userid: int, folder_id: int, db: Session = Depends(get_db)):
    """
    フォルダを削除します。子フォルダはDB制約でカスケード削除され、
    直属のノートはfolder_id=NULL（ルート直下）になります。
    """
    deleted = delete_my_note_folder(db, mdl_user_id=userid, folder_id=folder_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"My note folder not found: folder_id={folder_id}"
        )

    db.commit()


# ==========================================
# Note Endpoints
# ==========================================

@router.get(
    "/notes/{userid}",
    response_model=List[MyNoteResponse],
    summary="マイノート一覧取得"
)
def list_notes(
    userid: int,
    folder_id: Optional[int] = None,
    cmid: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    ユーザーのマイノート一覧を取得します。

    folder_idを指定するとそのフォルダ直下のノートのみに絞り込みます（0を渡すとルート直下のみ）。
    cmidを指定するとその教材に紐づくノートのみを返します（教材画面からの逆引き）。
    どちらも未指定の場合は全件を返します。
    """
    if folder_id is None:
        return list_my_notes(db, mdl_user_id=userid, folder_id_provided=False, cmid=cmid)

    resolved_folder_id = None if folder_id == 0 else folder_id
    return list_my_notes(
        db,
        mdl_user_id=userid,
        folder_id=resolved_folder_id,
        folder_id_provided=True,
        cmid=cmid,
    )


@router.post(
    "/notes/{userid}",
    response_model=MyNoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="マイノート作成"
)
def create_note(userid: int, data: MyNoteCreate, db: Session = Depends(get_db)):
    try:
        note = create_my_note(
            db,
            mdl_user_id=userid,
            title=data.title,
            contents=data.contents,
            folder_id=data.folder_id,
            courseid=data.courseid,
            cmid=data.cmid,
            favorite=data.favorite,
            from_ai=data.from_ai,
            from_coaching=data.from_coaching,
        )
        db.commit()
        db.refresh(note)
        return note
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/notes/{userid}/{noteid}",
    response_model=MyNoteResponse,
    summary="マイノート取得"
)
def get_note(userid: int, noteid: int, db: Session = Depends(get_db)):
    note = get_my_note(db, mdl_user_id=userid, noteid=noteid)

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"My note not found: noteid={noteid}"
        )

    return note


@router.put(
    "/notes/{userid}/{noteid}",
    response_model=MyNoteResponse,
    summary="マイノート更新"
)
def update_note(userid: int, noteid: int, data: MyNoteUpdate, db: Session = Depends(get_db)):
    fields_set = data.model_fields_set

    try:
        note = update_my_note(
            db,
            mdl_user_id=userid,
            noteid=noteid,
            title=data.title,
            contents=data.contents,
            folder_id=data.folder_id,
            folder_id_provided="folder_id" in fields_set,
            courseid=data.courseid,
            courseid_provided="courseid" in fields_set,
            cmid=data.cmid,
            cmid_provided="cmid" in fields_set,
            favorite=data.favorite,
            from_ai=data.from_ai,
            from_coaching=data.from_coaching,
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"My note not found: noteid={noteid}"
        )

    db.commit()
    db.refresh(note)
    return note


@router.delete(
    "/notes/{userid}/{noteid}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="マイノート削除"
)
def delete_note(userid: int, noteid: int, db: Session = Depends(get_db)):
    deleted = delete_my_note(db, mdl_user_id=userid, noteid=noteid)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"My note not found: noteid={noteid}"
        )

    db.commit()
