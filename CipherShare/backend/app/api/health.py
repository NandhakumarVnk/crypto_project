"""Health-check API route.

Provides a simple GET endpoint for verifying the backend is running.
"""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Return application health status and version."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "app_name": settings.app_name,
    }
