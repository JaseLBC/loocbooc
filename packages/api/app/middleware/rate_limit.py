"""
Rate limiting middleware using Redis.
Implements sliding window rate limiting per IP / API key.
"""
import logging
import time

from fastapi import HTTPException, Request, status

from app.config import settings
from app.redis import get_redis

logger = logging.getLogger(__name__)


async def rate_limit_middleware(request: Request, call_next):
    """
    Starlette middleware for rate limiting.
    Limits: N requests per minute per IP (or API key if present).
    """
    if not settings.RATE_LIMIT_ENABLED:
        return await call_next(request)

    # Skip health checks
    if request.url.path in ("/health", "/api/v1/health"):
        return await call_next(request)

    # Rate limit key: prefer API key, fall back to IP
    api_key = request.headers.get("X-API-Key", "")
    if api_key:
        rate_key = f"rl:key:{api_key[:20]}"
    else:
        client_ip = request.client.host if request.client else "unknown"
        rate_key = f"rl:ip:{client_ip}"

    try:
        redis = await get_redis()
        now = int(time.time())
        window_start = now - 60  # 1 minute window

        pipe = redis.pipeline()
        # Remove old requests outside the window
        pipe.zremrangebyscore(rate_key, 0, window_start)
        # Count requests in window
        pipe.zcard(rate_key)
        # Add current request
        pipe.zadd(rate_key, {str(now): now})
        # Set TTL
        pipe.expire(rate_key, 70)
        results = await pipe.execute()

        current_count = results[1]

        if current_count >= settings.RATE_LIMIT_REQUESTS_PER_MINUTE:
            logger.warning(f"Rate limit exceeded for {rate_key}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please slow down.",
                headers={"Retry-After": "60"},
            )

    except HTTPException:
        raise
    except Exception as e:
        # Don't block requests if Redis is down
        logger.error(f"Rate limiter error (allowing request): {e}")

    return await call_next(request)
