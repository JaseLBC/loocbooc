"""Health check endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.database import check_db_health
from app.redis import check_redis_health

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    version: str


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health_check():
    """
    Returns the health status of the API and its dependencies.
    Used by load balancers, Docker healthchecks, and monitoring.
    """
    from app.config import settings

    db_ok = await check_db_health()
    redis_ok = await check_redis_health()

    overall = "ok" if (db_ok and redis_ok) else "degraded"

    return HealthResponse(
        status=overall,
        database="ok" if db_ok else "error",
        redis="ok" if redis_ok else "error",
        version=settings.APP_VERSION,
    )
