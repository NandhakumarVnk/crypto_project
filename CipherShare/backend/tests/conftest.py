"""Shared test fixtures for the CipherShare backend test suite.

Uses an in-memory SQLite database so tests never touch the developer's
local database file.  Sets a test JWT secret via environment variable
before importing the application.
"""

import os

# Set test environment BEFORE importing anything from app.*
# so that config.py reads these instead of .env values.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-do-not-use-in-production-64chars-minimum-padding!!")
os.environ.setdefault("DATABASE_URL", "sqlite:///")  # in-memory

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app


# Create a fresh in-memory engine for each test session
_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)


def _override_get_db():
    """Yield a test database session."""
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _setup_db():
    """Create all tables before each test and drop them after."""
    Base.metadata.create_all(bind=_test_engine)
    yield
    Base.metadata.drop_all(bind=_test_engine)


@pytest.fixture()
def client() -> TestClient:
    """Return a FastAPI TestClient using the test database."""
    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
