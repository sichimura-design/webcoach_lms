"""
Mapper for course entities and DTOs
"""
import time
from entities.course import UserLastCourseAccess
from dto.request.course import CourseAccessCreate
from dto.response.course import CourseAccessResponse


class CourseMapper:
    """Course entity to DTO mapper"""

    # ==========================================
    # Request → Entity (Create)
    # ==========================================

    @staticmethod
    def from_create_request(
        request: CourseAccessCreate,
        current_time: int = None,
        accesscount: int = 1
    ) -> UserLastCourseAccess:
        """Convert CourseAccessCreate to UserLastCourseAccess entity"""
        if current_time is None:
            current_time = int(time.time())

        return UserLastCourseAccess(
            userid=request.userid,
            courseid=request.courseid,
            lastaccess=current_time,
            accesscount=accesscount,
            timemodified=current_time,
            timecreated=current_time
        )

    @staticmethod
    def update_access(entity: UserLastCourseAccess, current_time: int = None) -> UserLastCourseAccess:
        """Update UserLastCourseAccess entity with new access"""
        if current_time is None:
            current_time = int(time.time())

        entity.lastaccess = current_time
        entity.accesscount += 1
        entity.timemodified = current_time
        return entity

    # ==========================================
    # Entity → Response
    # ==========================================

    @staticmethod
    def to_course_access_response(entity: UserLastCourseAccess) -> CourseAccessResponse:
        """Convert UserLastCourseAccess entity to CourseAccessResponse DTO"""
        return CourseAccessResponse(
            id=entity.id,
            userid=entity.userid,
            courseid=entity.courseid,
            lastaccess=entity.lastaccess,
            accesscount=entity.accesscount,
            timemodified=entity.timemodified,
            timecreated=entity.timecreated
        )
