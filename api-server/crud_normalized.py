"""
CRUD operations for normalized WebCoach tables
正規化後のWebCoachテーブル用CRUD関数
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from entities.webcoach_normalized import WebCoachImage


# ==========================================
# Image Management (webcoach_image)
# ==========================================

def get_image(db: Session, entity_type: str, entity_id: int) -> Optional[str]:
    """
    画像URLを取得

    Args:
        db: Database session
        entity_type: 'course', 'category'
        entity_id: エンティティID

    Returns:
        画像URL (存在しない場合はNone)
    """
    if entity_type not in ['course', 'category']:
        raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'course' or 'category'")

    image_record = db.query(WebCoachImage).filter(
        WebCoachImage.entity_type == entity_type,
        WebCoachImage.entity_id == entity_id
    ).first()

    return image_record.image_url if image_record else None


def upsert_image(
    db: Session,
    entity_type: str,
    entity_id: int,
    image_url: str
) -> WebCoachImage:
    """
    画像URLを登録または更新

    Args:
        db: Database session
        entity_type: 'course', 'category'
        entity_id: エンティティID
        image_url: 画像URL

    Returns:
        作成または更新された画像レコード
    """
    if entity_type not in ['course', 'category']:
        raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'course' or 'category'")

    existing = db.query(WebCoachImage).filter(
        WebCoachImage.entity_type == entity_type,
        WebCoachImage.entity_id == entity_id
    ).first()

    if existing:
        # Update existing record
        existing.image_url = image_url
        existing.updated_at = text('CURRENT_TIMESTAMP')
        db.flush()
        return existing
    else:
        # Create new record
        new_record = WebCoachImage(
            entity_type=entity_type,
            entity_id=entity_id,
            image_url=image_url,
            created_at=text('CURRENT_TIMESTAMP'),
            updated_at=text('CURRENT_TIMESTAMP')
        )
        db.add(new_record)
        db.flush()
        return new_record


def delete_image(db: Session, entity_type: str, entity_id: int) -> bool:
    """
    画像URLを削除

    Args:
        db: Database session
        entity_type: 'course', 'category'
        entity_id: エンティティID

    Returns:
        削除成功ならTrue
    """
    if entity_type not in ['course', 'category']:
        raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'course' or 'category'")

    result = db.query(WebCoachImage).filter(
        WebCoachImage.entity_type == entity_type,
        WebCoachImage.entity_id == entity_id
    ).delete()

    return result > 0


def get_images_by_type(db: Session, entity_type: str) -> List[Dict[str, Any]]:
    """
    エンティティタイプ別に画像URL一覧を取得

    Args:
        db: Database session
        entity_type: 'course', 'category'

    Returns:
        画像URL一覧
    """
    if entity_type not in ['course', 'category']:
        raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'course' or 'category'")

    records = db.query(WebCoachImage).filter(
        WebCoachImage.entity_type == entity_type
    ).all()

    return [
        {
            'entity_type': record.entity_type,
            'entity_id': record.entity_id,
            'image_url': record.image_url,
            'created_at': record.created_at,
            'updated_at': record.updated_at
        }
        for record in records
    ]


