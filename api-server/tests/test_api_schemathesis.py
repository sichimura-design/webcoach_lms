"""
Schemathesis-based API tests
Automatically generates tests from OpenAPI specification
"""
import schemathesis
from hypothesis import settings
from fastapi.testclient import TestClient
import pytest

# Path to the OpenAPI/Swagger specification
SCHEMA_PATH = "/home/ec2-user/moodle-docker/bff-server/swagger.yaml"

# Load the schema
schema = schemathesis.openapi.from_path(SCHEMA_PATH)


@pytest.fixture
def schema_test_client(client):
    """
    Return the FastAPI test client for schemathesis
    """
    return client


# Basic schemathesis test with default settings
@schema.parametrize()
@settings(max_examples=10, deadline=None)
def test_api_endpoints(case, schema_test_client):
    """
    Test all API endpoints defined in swagger.yaml

    Schemathesis will automatically:
    - Generate valid requests based on the schema
    - Test response status codes
    - Validate response schemas
    - Check for common API issues
    """
    # Filter out endpoints that require authentication or are BFF-specific
    # Only test WebCoach endpoints that map to API server
    webcoach_paths = [
        "/api/webcoach/profile/",
        "/api/webcoach/resumecourse/",
        "/api/webcoach/recomendbadge/",
        "/api/webcoach/roadmaps",
        "/api/webcoach/roadmap/",
    ]

    # Skip if not a WebCoach endpoint (since we're testing api-server)
    if not any(case.path.startswith(path) for path in webcoach_paths):
        pytest.skip("Not an API server endpoint")

    # Make the request
    response = case.call(base_url="http://testserver")

    # Validate the response
    case.validate_response(response)


# Test with specific checks
@schema.parametrize(endpoint="/api/webcoach/profile/{userid}")
@settings(max_examples=5, deadline=None)
def test_profile_endpoint(case, schema_test_client):
    """
    Test WebCoach profile endpoints specifically
    """
    response = case.call(base_url="http://testserver")

    # Basic validation
    case.validate_response(response)

    # Additional custom checks
    if response.status_code == 200:
        assert response.json() is not None
        # Check that response has expected fields
        data = response.json()
        if isinstance(data, dict):
            assert "mdl_user_id" in data or "error" in data


@schema.parametrize(endpoint="/api/webcoach/resumecourse/{userid}")
@settings(max_examples=5, deadline=None)
def test_resume_course_endpoint(case, schema_test_client):
    """
    Test resume course endpoints
    """
    response = case.call(base_url="http://testserver")

    # Validate response
    case.validate_response(response)

    # Check response structure for successful requests
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)


# Custom test for POST endpoints
@schema.parametrize(method="POST")
@settings(max_examples=5, deadline=None)
def test_post_endpoints(case, schema_test_client):
    """
    Test all POST endpoints
    """
    # Only test WebCoach POST endpoints
    webcoach_post_paths = [
        "/api/webcoach/profile/",
        "/api/webcoach/resumecourse/",
    ]

    if not any(case.path.startswith(path) for path in webcoach_post_paths):
        pytest.skip("Not an API server POST endpoint")

    response = case.call(base_url="http://testserver")
    case.validate_response(response)


# Test with stateful testing (testing sequences of API calls)
@pytest.mark.skip(reason="Stateful testing requires authentication setup")
class TestStatefulAPI:
    """
    Stateful API testing - test sequences of API calls
    This requires proper authentication and session management
    """

    @schema.parametrize()
    @settings(max_examples=3, deadline=None)
    def test_create_and_read_profile(self, case, schema_test_client):
        """
        Test creating a profile and then reading it
        """
        # This would test sequences like:
        # 1. POST /api/webcoach/profile/{userid} (create/update)
        # 2. GET /api/webcoach/profile/{userid} (read)
        pass


# Custom validation hooks
@schema.hooks.register("before_call")
def before_call(context, case):
    """
    Hook that runs before each API call
    Can be used to add authentication, modify requests, etc.
    """
    # Add custom headers if needed
    # case.headers = case.headers or {}
    # case.headers["X-Test-Mode"] = "true"
    pass


@schema.hooks.register("after_call")
def after_call(context, case, response):
    """
    Hook that runs after each API call
    Can be used for custom logging or validation
    """
    # Custom logging
    # print(f"Called {case.method} {case.path} -> {response.status_code}")
    pass
