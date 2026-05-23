"""
Database connection and session management
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Database connection settings
MOODLE_DB_HOST = os.getenv("MOODLE_DB_HOST", "localhost")
MOODLE_DB_PORT = os.getenv("MOODLE_DB_PORT", "3306")
MOODLE_DB_USER = os.getenv("MOODLE_DB_USER", "moodleuser")
MOODLE_DB_PASSWORD = os.getenv("MOODLE_DB_PASSWORD", "")
MOODLE_DB_NAME = os.getenv("MOODLE_DB_NAME", "moodle")

# Create database URL
DATABASE_URL = f"mysql+pymysql://{MOODLE_DB_USER}:{MOODLE_DB_PASSWORD}@{MOODLE_DB_HOST}:{MOODLE_DB_PORT}/{MOODLE_DB_NAME}?charset=utf8mb4"

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    echo=False,          # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()


def get_db():
    """
    Database session dependency for FastAPI
    Usage in route: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
