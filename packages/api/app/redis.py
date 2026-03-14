"""
Redis connection management using the async redis client.
Provides caching and job queue functionality.
"""
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Returns the Redis client, initialising if needed."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def close_redis() -> None:
    """Closes the Redis connection pool."""
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None


async def check_redis_health() -> bool:
    """Returns True if Redis is reachable."""
    try:
        client = await get_redis()
        await client.ping()
        return True
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False


class CacheManager:
    """High-level cache operations for Loocbooc entities."""

    def __init__(self, prefix: str = "lb"):
        self.prefix = prefix

    def _key(self, *parts: str) -> str:
        return f"{self.prefix}:{':'.join(parts)}"

    async def get(self, *key_parts: str) -> Any | None:
        """Get cached value, returns None if not found."""
        try:
            client = await get_redis()
            raw = await client.get(self._key(*key_parts))
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as e:
            logger.warning(f"Cache get failed for {key_parts}: {e}")
            return None

    async def set(self, *key_parts: str, value: Any, ttl: int = 300) -> bool:
        """Set cached value with TTL in seconds."""
        try:
            client = await get_redis()
            await client.setex(
                self._key(*key_parts),
                ttl,
                json.dumps(value, default=str),
            )
            return True
        except Exception as e:
            logger.warning(f"Cache set failed for {key_parts}: {e}")
            return False

    async def delete(self, *key_parts: str) -> bool:
        """Delete cached value."""
        try:
            client = await get_redis()
            await client.delete(self._key(*key_parts))
            return True
        except Exception as e:
            logger.warning(f"Cache delete failed for {key_parts}: {e}")
            return False

    async def push_job(self, queue: str, payload: dict) -> bool:
        """Push a job to a Redis list queue."""
        try:
            client = await get_redis()
            await client.lpush(queue, json.dumps(payload, default=str))
            return True
        except Exception as e:
            logger.error(f"Job push failed for queue {queue}: {e}")
            return False


# Global cache manager instance
cache = CacheManager()
