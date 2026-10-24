"""CipherShare — application configuration.

Reads settings from environment variables (or .env file) using pydantic-settings.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application-wide settings loaded from environment variables."""

    app_name: str = "CipherShare"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./ciphershare.db"

    # CORS — origins allowed to call the API (comma-separated in .env)
    cors_origins: str = "http://localhost:5173"

    # JWT authentication
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Password policy
    password_min_length: int = 12
    password_max_length: int = 128

    # Storage
    upload_dir: str = "./storage/encrypted_files"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


_PLACEHOLDER_SECRETS = frozenset({
    "",
    "CHANGE_ME",
    "change_me",
    "your-secret-key-here",
    "replace-me",
    "REPLACE_ME",
    "secret",
})


def _validate_jwt_secret(secret: str) -> None:
    """Raise if the JWT secret is missing or obviously a placeholder."""
    if secret.strip() in _PLACEHOLDER_SECRETS:
        raise RuntimeError(
            "JWT_SECRET_KEY is not configured or is set to a placeholder value.\n"
            "Generate a secure secret with PowerShell:\n"
            '  python -c "import secrets; print(secrets.token_urlsafe(64))"\n'
            "Then set JWT_SECRET_KEY in your backend/.env file."
        )


settings = Settings()
_validate_jwt_secret(settings.jwt_secret_key)
