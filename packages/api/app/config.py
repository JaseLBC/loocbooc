"""
Application configuration via Pydantic BaseSettings.
All config loaded from environment variables or .env file.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- App ---
    APP_NAME: str = "Loocbooc API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    SECRET_KEY: str = Field(default="changeme-in-production-use-32-plus-chars")
    API_PREFIX: str = "/api/v1"

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://loocbooc:loocbooc@localhost:5432/loocbooc"

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Auth ---
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    API_KEY_PREFIX: str = "lb_live_"

    # --- Storage ---
    STORAGE_BACKEND: Literal["s3", "gcs", "local", "minio"] = "local"
    STORAGE_BUCKET: str = "loocbooc-garments"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-southeast-2"
    LOCAL_STORAGE_PATH: str = "/tmp/loocbooc-storage"

    # --- MinIO (S3-compatible local storage for dev) ---
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "loocbooc-dev"

    # --- Anthropic ---
    ANTHROPIC_API_KEY: str = ""

    # --- Rate Limiting ---
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 10

    # --- File Upload ---
    MAX_FILE_SIZE_MB: int = 100
    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]
    ALLOWED_VIDEO_TYPES: list[str] = ["video/mp4"]
    ALLOWED_PATTERN_TYPES: list[str] = [
        "application/postscript",  # .ai
        "image/vnd.dxf",  # .dxf
        "application/dxf",  # .dxf alternate
        "application/octet-stream",  # generic binary (zprj, avt)
    ]

    # --- Loocbooc Epoch (milliseconds since 2024-01-01 00:00:00 UTC) ---
    LOOCBOOC_EPOCH_MS: int = 1704067200000  # 2024-01-01T00:00:00Z

    # --- Cache TTLs ---
    CACHE_TTL_PUBLIC_GARMENT: int = 300    # 5 minutes
    CACHE_TTL_DRAFT_GARMENT: int = 30     # 30 seconds
    CACHE_TTL_PHYSICS: int = 3600         # 1 hour

    # --- 3D Pipeline ---
    PIPELINE_MIN_PHOTOS: int = 8
    PIPELINE_JOB_QUEUE: str = "pipeline:jobs"

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL must be set")
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        import logging as _logging
        _logger = _logging.getLogger(__name__)
        weak_defaults = {
            "changeme-in-production-use-32-plus-chars",
            "changeme",
            "secret",
            "development",
        }
        if v in weak_defaults and len(v) < 32:
            # In development this is acceptable; in production this is a vulnerability
            _logger.warning(
                "SECRET_KEY is set to a weak default. "
                "Set a strong random SECRET_KEY in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        if len(v) < 16:
            raise ValueError(
                "SECRET_KEY must be at least 16 characters. "
                "Use a strong random key in production."
            )
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
