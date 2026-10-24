"""CipherShare — FastAPI application factory.

Creates and configures the main FastAPI application instance.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.transfers import router as transfers_router
from app.api.keys import router as keys_router
from app.api.security import router as security_router
from app.api.benchmarks import router as benchmarks_router

# Import models so their tables are registered with Base.metadata
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create database tables on startup (development convenience).

    For production, consider using Alembic migrations instead.
    """
    Base.metadata.create_all(bind=engine)
    yield


def create_app() -> FastAPI:
    """Build and return the FastAPI application."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # CORS — allow the frontend dev server to call the API
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            origin.strip()
            for origin in settings.cors_origins.split(",")
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(transfers_router)
    application.include_router(keys_router)
    application.include_router(security_router)
    application.include_router(benchmarks_router)

    return application
app = create_app()
