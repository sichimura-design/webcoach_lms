"""
FastAPI Application for Moodle User Tracking
Main entry point - registers all routers
"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import engine, Base

# Import routers
from routers import health, courses, profiles, webcoach, badges, roadmaps, ai, ai_langgraph, admin, tags, faiss_ingest

# Load environment variables
load_dotenv()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI app
app = FastAPI(
    title="Moodle User Tracking API",
    description="API for tracking user course access and managing profile settings",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENABLE_DOCS", "true").lower() == "true" else None,
    redoc_url="/redoc" if os.getenv("ENABLE_DOCS", "true").lower() == "true" else None,
)

# Register rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables on startup
@app.on_event("startup")
def startup_event():
    """Create database tables if they don't exist"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created/verified successfully")


# Register routers
app.include_router(health.router)
app.include_router(courses.router)
app.include_router(profiles.router)
app.include_router(webcoach.router)
app.include_router(badges.router)
app.include_router(roadmaps.router)
app.include_router(ai.router)
app.include_router(ai_langgraph.router)  # LangGraph版AIチャット
app.include_router(admin.router)
app.include_router(tags.router)
app.include_router(faiss_ingest.router)  # FAISS取り込み


# ==========================================
# Run server
# ==========================================

if __name__ == "__main__":
    import uvicorn

    HOST = os.getenv("API_SERVER_HOST", "0.0.0.0")
    PORT = int(os.getenv("API_SERVER_PORT", "8001"))
    ENV = os.getenv("ENV", "production")

    # 環境に応じてreloadを設定
    reload = ENV == "development"

    # 本番環境でのホットリロード防止
    if ENV == "production" and reload:
        raise ValueError("reload must be False in production")

    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=reload,
        workers=1 if reload else 4,
        log_level="info"
    )
