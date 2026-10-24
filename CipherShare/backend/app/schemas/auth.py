"""Pydantic schemas for authentication requests and responses.

Separates API data transfer objects from the SQLAlchemy ORM model.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.core.config import settings


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    """Body for POST /api/auth/register."""

    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Trim whitespace and lowercase the email."""
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Enforce minimum and maximum password length."""
        if len(v) < settings.password_min_length:
            raise ValueError(
                f"Password must be at least {settings.password_min_length} characters."
            )
        if len(v) > settings.password_max_length:
            raise ValueError(
                f"Password must be at most {settings.password_max_length} characters."
            )
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


from app.schemas.base import BaseSchema


class UserResponse(BaseSchema):
    """Safe user representation — never includes hashed_password."""

    id: int
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Response for successful login."""

    access_token: str
    token_type: str = "bearer"
