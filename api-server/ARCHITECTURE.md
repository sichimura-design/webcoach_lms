# API Server Architecture

## Directory Structure

```
api-server/
├── entities/           # Database Entities (SQLAlchemy ORM)
│   ├── __init__.py
│   ├── profile.py      # UserProfileSettings
│   ├── course.py       # UserLastCourseAccess
│   └── webcoach.py     # WebCoach specific tables
│
├── dto/                # Data Transfer Objects
│   ├── request/        # Request DTOs
│   │   ├── __init__.py
│   │   ├── profile.py  # ProfileSettingsCreate, ProfileSettingsUpdate, etc.
│   │   ├── course.py   # CourseAccessCreate, ResumeCourseUpdate
│   │   └── common.py   # BulkUploadRequest
│   │
│   └── response/       # Response DTOs
│       ├── __init__.py
│       ├── profile.py  # ProfileSettingsResponse, UserProfileResponse, etc.
│       ├── course.py   # CourseAccessResponse, LastAccessedCourse, etc.
│       ├── badge.py    # BadgeResponse, UserBadgesResponse
│       ├── roadmap.py  # RoadmapResponse, RoadmapListResponse
│       └── common.py   # HealthResponse, ErrorResponse, BulkUpload*
│
├── mappers/            # Entity ↔ DTO converters
│   ├── __init__.py
│   ├── profile_mapper.py  # ProfileMapper
│   └── course_mapper.py   # CourseMapper
│
├── routers/            # API Router層
│   ├── __init__.py
│   ├── health.py       # Health check / root endpoints
│   ├── courses.py      # Course access endpoints
│   ├── profiles.py     # Profile settings endpoints
│   ├── webcoach.py     # WebCoach specific endpoints
│   ├── badges.py       # Badge endpoints
│   ├── roadmaps.py     # Roadmap endpoints
│   ├── ai.py           # AI chat endpoints
│   └── admin.py        # Admin / bulk update endpoints
│
├── database.py         # Database connection and Base
├── crud.py             # CRUD operations
├── main.py             # FastAPI application (73 lines)
└── api_server.py       # AI/RAG API server (未統合)
```

## Layer Responsibilities

### Entities (`entities/`)
- SQLAlchemy ORM models
- Direct mapping to database tables
- Contains database schema definitions
- Used by CRUD layer

### DTOs (`dto/`)
- **Request DTOs**: Validation schemas for incoming API requests
- **Response DTOs**: Standardized formats for API responses
- Pydantic models for automatic validation and serialization
- Separated from database entities for flexibility

### Mappers (`mappers/`)
- **Bidirectional conversion** between entities and DTOs
- Centralized transformation logic
- Handles type conversions (e.g., int to bool for MySQL TINYINT)

### Routers (`routers/`)
- **API endpoint definitions** organized by domain/feature
- Each router handles a specific area of functionality
- Registered in `main.py` using `app.include_router()`
- Benefits:
  - Better code organization
  - Easier to maintain and test
  - Clear separation of concerns
  - **Reduced main.py from 1,169 lines to 73 lines**

#### Mapper Methods

Each mapper provides three types of methods:

1. **Request → Entity (Create)**: `from_create_request()`
   - Creates new entity from request DTO
   - Sets timestamps automatically

2. **Request → Entity (Update)**: `update_from_request()`
   - Updates existing entity with request DTO
   - Handles partial updates
   - Updates timestamp automatically

3. **Entity → Response**: `to_*_response()`
   - Converts entity to response DTO
   - Handles type conversions

## Usage Examples

### Creating a new endpoint

```python
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from database import get_db
from dto.request import ProfileSettingsCreate
from dto.response import ProfileSettingsResponse
from crud import create_profile_settings

app = FastAPI()

@app.post("/api/profile", response_model=ProfileSettingsResponse)
def create_profile(
    data: ProfileSettingsCreate,
    db: Session = Depends(get_db)
):
    result = create_profile_settings(db, data)
    return result
```

### Using mappers in CRUD operations

```python
from entities import UserProfileSettings
from dto.request import ProfileSettingsCreate, ProfileSettingsUpdate
from mappers import ProfileMapper

# Request → Entity (Create)
request = ProfileSettingsCreate(userid=123, theme="dark")
entity = ProfileMapper.from_create_request(request)
db.add(entity)
db.commit()

# Request → Entity (Update)
update_request = ProfileSettingsUpdate(theme="light")
ProfileMapper.update_from_request(entity, update_request)
db.commit()

# Entity → Response DTO
response = ProfileMapper.to_profile_settings_response(entity)
return response
```

### Course mapper example

```python
from entities import UserLastCourseAccess
from dto.request import CourseAccessCreate
from mappers import CourseMapper

# Create new course access
request = CourseAccessCreate(userid=1, courseid=100)
entity = CourseMapper.from_create_request(request)
db.add(entity)

# Update existing access
CourseMapper.update_access(entity)
db.commit()

# Convert to response
response = CourseMapper.to_course_access_response(entity)
```

## Migration Notes

- Old `schemas.py` → `entities/` (renamed and split)
- Old `models.py` → `dto/request/` and `dto/response/` (split by direction)
- `from_orm_model()` methods → `mappers/` (centralized conversion)
- Backup files: `schemas.py.bak`, `models.py.bak`
