"""Tests for the authentication API: registration, login, and /me endpoint."""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services.auth_service import hash_password


# ── Helpers ──────────────────────────────────────────────────────────────────

VALID_EMAIL = "  Test@Example.COM  "
NORMALISED_EMAIL = "test@example.com"
VALID_PASSWORD = "SecurePass123!"  # 14 chars, meets minimum 12
SHORT_PASSWORD = "short"           # too short


def _register(client: TestClient, email: str = VALID_EMAIL, password: str = VALID_PASSWORD):
    """Helper to register a user."""
    return client.post("/api/auth/register", json={"email": email, "password": password})


def _login(client: TestClient, username: str = NORMALISED_EMAIL, password: str = VALID_PASSWORD):
    """Helper to log in a user via OAuth2 form."""
    return client.post("/api/auth/login", data={"username": username, "password": password})


def _register_and_login(client: TestClient):
    """Register then login, returning the login response."""
    _register(client)
    return _login(client)


# ── Registration Tests ───────────────────────────────────────────────────────


class TestRegistration:
    """POST /api/auth/register"""

    def test_register_returns_201(self, client: TestClient) -> None:
        resp = _register(client)
        assert resp.status_code == 201

    def test_register_returns_user_fields(self, client: TestClient) -> None:
        data = _register(client).json()
        assert "id" in data
        assert "email" in data
        assert "is_active" in data
        assert "created_at" in data

    def test_register_email_is_normalised(self, client: TestClient) -> None:
        data = _register(client).json()
        assert data["email"] == NORMALISED_EMAIL

    def test_register_password_not_in_response(self, client: TestClient) -> None:
        data = _register(client).json()
        assert "password" not in data
        assert "hashed_password" not in data

    def test_register_password_not_stored_plaintext(self, client: TestClient) -> None:
        """The stored hash must differ from the original password."""
        # Register a user
        _register(client)
        # Verify via service layer
        from app.services.auth_service import get_user_by_email, verify_password

        # We need a DB session - use the test override
        from tests.conftest import _TestingSessionLocal
        db = _TestingSessionLocal()
        try:
            user = get_user_by_email(db, NORMALISED_EMAIL)
            assert user is not None
            assert user.hashed_password != VALID_PASSWORD
            assert verify_password(VALID_PASSWORD, user.hashed_password)
        finally:
            db.close()

    def test_register_duplicate_email_returns_409(self, client: TestClient) -> None:
        _register(client)
        resp = _register(client)
        assert resp.status_code == 409

    def test_register_invalid_email_is_rejected(self, client: TestClient) -> None:
        resp = _register(client, email="not-an-email")
        assert resp.status_code == 422

    def test_register_short_password_is_rejected(self, client: TestClient) -> None:
        resp = _register(client, password=SHORT_PASSWORD)
        assert resp.status_code == 422

    def test_register_too_long_password_is_rejected(self, client: TestClient) -> None:
        resp = _register(client, password="a" * (settings.password_max_length + 1))
        assert resp.status_code == 422

    def test_register_user_is_active_by_default(self, client: TestClient) -> None:
        data = _register(client).json()
        assert data["is_active"] is True


# ── Login Tests ──────────────────────────────────────────────────────────────


class TestLogin:
    """POST /api/auth/login"""

    def test_login_returns_access_token(self, client: TestClient) -> None:
        _register(client)
        resp = _login(client)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password_returns_401(self, client: TestClient) -> None:
        _register(client)
        resp = _login(client, password="WrongPassword123!")
        assert resp.status_code == 401

    def test_login_unknown_email_returns_401(self, client: TestClient) -> None:
        resp = _login(client, username="nobody@example.com")
        assert resp.status_code == 401

    def test_login_wrong_password_same_error_as_unknown_email(self, client: TestClient) -> None:
        """Both wrong-password and unknown-email should return the same generic error shape."""
        _register(client)
        resp_wrong_pw = _login(client, password="WrongPassword123!")
        resp_unknown = _login(client, username="nobody@example.com")
        assert resp_wrong_pw.status_code == resp_unknown.status_code
        # Same detail structure (generic message)
        assert resp_wrong_pw.json()["detail"] == resp_unknown.json()["detail"]

    def test_login_inactive_user_returns_401(self, client: TestClient) -> None:
        """An inactive user must not be able to log in."""
        _register(client)
        # Deactivate the user directly in the DB
        from tests.conftest import _TestingSessionLocal
        from app.services.auth_service import get_user_by_email
        db = _TestingSessionLocal()
        try:
            user = get_user_by_email(db, NORMALISED_EMAIL)
            user.is_active = False
            db.commit()
        finally:
            db.close()
        resp = _login(client)
        assert resp.status_code == 401


# ── Protected Endpoint Tests (/api/auth/me) ──────────────────────────────────


class TestMe:
    """GET /api/auth/me"""

    def test_me_returns_user_profile(self, client: TestClient) -> None:
        login_data = _register_and_login(client).json()
        token = login_data["access_token"]
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == NORMALISED_EMAIL
        assert "hashed_password" not in data

    def test_me_missing_token_returns_401(self, client: TestClient) -> None:
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_malformed_token_returns_401(self, client: TestClient) -> None:
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.valid.jwt"})
        assert resp.status_code == 401

    def test_me_expired_token_returns_401(self, client: TestClient) -> None:
        """A token with exp in the past must be rejected."""
        _register(client)
        # Manually create an expired token
        payload = {
            "sub": "1",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=5),
            "iat": datetime.now(timezone.utc) - timedelta(minutes=35),
        }
        expired_token = jwt.encode(
            payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert resp.status_code == 401

    def test_me_token_for_nonexistent_user_returns_401(self, client: TestClient) -> None:
        """A valid token referencing a deleted user must be rejected."""
        token_data = _register_and_login(client).json()
        token = token_data["access_token"]

        # Delete the user directly
        from tests.conftest import _TestingSessionLocal
        from app.services.auth_service import get_user_by_email
        db = _TestingSessionLocal()
        try:
            user = get_user_by_email(db, NORMALISED_EMAIL)
            db.delete(user)
            db.commit()
        finally:
            db.close()

        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_me_inactive_user_returns_401(self, client: TestClient) -> None:
        """An inactive user's token must be rejected."""
        token_data = _register_and_login(client).json()
        token = token_data["access_token"]

        # Deactivate the user directly
        from tests.conftest import _TestingSessionLocal
        from app.services.auth_service import get_user_by_email
        db = _TestingSessionLocal()
        try:
            user = get_user_by_email(db, NORMALISED_EMAIL)
            user.is_active = False
            db.commit()
        finally:
            db.close()

        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
