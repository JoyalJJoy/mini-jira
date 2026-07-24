"""Redis client with Upstash TLS support.

Automatically converts redis:// → rediss:// for Upstash-hosted instances.
Gracefully handles connection failures — if Redis is unreachable the app
continues without caching (database fallback).
"""

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger("redis")

_redis: aioredis.Redis | None = None
_pubsub: aioredis.client.PubSub | None = None


def _build_redis_url() -> str:
    """Build a proper Redis URL with TLS for Upstash."""
    url = settings.redis_url
    if not url:
        return ""

    # Upstash requires TLS → use rediss:// scheme
    if url.startswith("redis://") and ("upstash.io" in url or "redistls" in url):
        url = url.replace("redis://", "rediss://", 1)

    return url


async def connect_redis() -> aioredis.Redis | None:
    """Create Redis connection. Returns None if connection fails."""
    global _redis, _pubsub

    url = _build_redis_url()
    if not url:
        logger.info("REDIS_URL not configured — skipping Redis")
        return None

    try:
        _redis = aioredis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        # Ping to verify connection
        await _redis.ping()
        logger.info("Connected to Redis (%s)", url.split("@")[-1] if "@" in url else url)
        return _redis
    except Exception as e:
        logger.warning("Redis connection failed (%s) — running without cache", e)
        _redis = None
        return None


async def close_redis():
    """Close Redis connection gracefully."""
    global _redis, _pubsub
    if _pubsub:
        await _pubsub.unsubscribe()
        _pubsub = None
    if _redis:
        await _redis.aclose()
        _redis = None


def get_redis() -> aioredis.Redis | None:
    """Get the global Redis instance (may be None if unavailable)."""
    return _redis


# ── Cache helpers ────────────────────────────────────────────────

CACHE_TTL = 60  # seconds


async def cache_get(key: str) -> Any | None:
    """Get a JSON value from cache. Returns None on miss or error."""
    r = get_redis()
    if not r:
        return None
    try:
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception as e:
        logger.debug("Cache GET error for %s: %s", key, e)
        return None


async def cache_set(key: str, value: Any, ttl: int = CACHE_TTL):
    """Set a JSON value in cache with TTL. Silently ignores errors."""
    r = get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.debug("Cache SET error for %s: %s", key, e)


async def cache_delete(key: str):
    """Delete a key from cache. Silently ignores errors."""
    r = get_redis()
    if not r:
        return
    try:
        await r.delete(key)
    except Exception as e:
        logger.debug("Cache DEL error for %s: %s", key, e)


# ── Rate limiting ────────────────────────────────────────────────

async def check_rate_limit(key: str, max_requests: int = 100, window: int = 60) -> tuple[bool, int]:
    """Check if a key has exceeded the rate limit.

    Returns (is_allowed, remaining_requests).
    Uses a sliding window with Redis INCR + EXPIRE.
    """
    r = get_redis()
    if not r:
        return True, max_requests  # No Redis = no rate limiting

    try:
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window)
        remaining = max(0, max_requests - count)
        return count <= max_requests, remaining
    except Exception as e:
        logger.debug("Rate limit check error: %s", e)
        return True, max_requests
