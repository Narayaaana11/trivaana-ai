"""
TRIVAANA AI: Per-IP Sliding-Window Rate Limiting Middleware
Supports Redis INCR/EXPIRE when REDIS_URL + redis package are configured,
with thread-safe in-memory sliding-window fallback for single-node deployments.
"""

from collections import defaultdict, deque
import os
import threading
import time
from typing import Deque, Dict, Optional, Tuple
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import settings


class SlidingWindowRateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self._redis = None
        if settings.has_redis:
            try:
                import redis  # type: ignore
                self._redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=1.0)
            except Exception:
                self._redis = None

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        if self._redis is not None:
            try:
                pipe = self._redis.pipeline()
                pipe.incr(key, 1)
                pipe.expire(key, window_seconds, nx=True)
                count, _ = pipe.execute()
                remaining = max(0, limit - int(count))
                return int(count) <= limit, remaining
            except Exception:
                pass

        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                return False, 0
            bucket.append(now)
            return True, max(0, limit - len(bucket))


rate_limiter = SlidingWindowRateLimiter()


def resolve_rate_limit_rule(path: str, method: str) -> Optional[Tuple[str, int, int]]:
    if method.upper() != "POST":
        return None
    if path.startswith("/api/auth/login") or path.startswith("/api/auth/register"):
        return ("auth", 30, 60)
    if path.startswith("/api/auth/password-reset/"):
        return ("auth_reset", 10, 60)
    if path.startswith("/api/public/lead-intake/"):
        return ("public_intake", 60, 60)
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if settings.ENVIRONMENT.lower() == "test":
            return await call_next(request)
        if os.environ.get("PYTEST_CURRENT_TEST") and request.headers.get("x-test-rate-limit") != "1":
            return await call_next(request)

        rule = resolve_rate_limit_rule(request.url.path, request.method)
        if rule is None:
            return await call_next(request)

        bucket_name, limit, window_sec = rule
        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )
        key = f"rl:{bucket_name}:{client_ip}"
        allowed, remaining = rate_limiter.is_allowed(key, limit, window_sec)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded for {bucket_name}. Try again in {window_sec}s."},
                headers={"Retry-After": str(window_sec), "X-RateLimit-Remaining": "0"},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

