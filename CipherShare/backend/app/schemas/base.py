"""Base Pydantic schemas with automatic UTC timezone handling for SQLite datetimes."""

from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, field_validator


class BaseSchema(BaseModel):
    """Base schema ensuring all naive datetimes are marked as UTC."""

    @field_validator("*", mode="after")
    @classmethod
    def ensure_utc_datetimes(cls, v: Any) -> Any:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v
