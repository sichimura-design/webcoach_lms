"""
WebCoach Normalized entity models
正規化後の画像・タグ管理テーブル
"""
from sqlalchemy import Column, BigInteger, String, Text, Boolean, Integer, Enum, TIMESTAMP, Index
from database import Base


class WebCoachImage(Base):
    """
    WebCoach: 画像URL統合テーブル
    コース・カテゴリの画像を統一管理（タグは除外）
    """
    __tablename__ = "webcoach_image"

    entity_type = Column(
        Enum('course', 'category', name='entity_type_enum'),
        primary_key=True,
        nullable=False,
        comment='エンティティタイプ'
    )
    entity_id = Column(
        BigInteger,
        primary_key=True,
        nullable=False,
        comment='エンティティID（コース/カテゴリのID）'
    )
    image_url = Column(String(512), nullable=False, comment='画像URL')
    created_at = Column(TIMESTAMP, nullable=False, comment='作成日時')
    updated_at = Column(TIMESTAMP, nullable=False, comment='更新日時')

    __table_args__ = (
        Index('idx_entity', 'entity_type', 'entity_id'),
    )


