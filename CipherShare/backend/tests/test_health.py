"""Tests for the /api/health endpoint."""

from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Verify the health-check route behaves correctly."""

    def test_health_returns_200(self, client: TestClient) -> None:
        """GET /api/health should return HTTP 200."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_returns_healthy_status(self, client: TestClient) -> None:
        """The response body must include status=healthy."""
        data = client.get("/api/health").json()
        assert data["status"] == "healthy"

    def test_health_returns_version(self, client: TestClient) -> None:
        """The response body must include a version string."""
        data = client.get("/api/health").json()
        assert "version" in data
        assert isinstance(data["version"], str)
        assert len(data["version"]) > 0

    def test_health_returns_app_name(self, client: TestClient) -> None:
        """The response body must include the app name."""
        data = client.get("/api/health").json()
        assert data["app_name"] == "CipherShare"

    def test_health_response_content_type(self, client: TestClient) -> None:
        """The response should be JSON."""
        response = client.get("/api/health")
        assert "application/json" in response.headers["content-type"]
