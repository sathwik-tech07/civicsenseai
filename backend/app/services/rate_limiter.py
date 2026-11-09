import os
import time
import math
import uuid
import logging
import threading
import ipaddress
from abc import ABC, abstractmethod
from typing import Optional, Tuple, List, Dict, Any

from fastapi import Request, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal, engine
from app.models.rate_limit import RateLimitEvent

logger = logging.getLogger(__name__)


class RateLimitStorageError(Exception):
    """Raised when rate-limit storage operations fail."""
    pass


class BaseRateLimitStorage(ABC):
    """Abstract interface for rate limiting backends."""

    @abstractmethod
    def atomic_check_and_record(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> Tuple[bool, int, int, Optional[Any]]:
        """
        Atomically checks sliding-window quota and records the attempt if within limit.
        Guarantees that concurrent requests cannot exceed the limit.
        Returns:
            (is_limited: bool, current_count: int, retry_after_seconds: int, attempt_id: Optional[Any])
        """
        pass

    @abstractmethod
    def remove_attempt(self, key: str, attempt_id: Any) -> None:
        """
        Removes a single specific attempt by ID (e.g. on successful login).
        Does NOT clear other failed attempts for the key.
        """
        pass

    @abstractmethod
    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int]:
        """
        Read-only check of whether the key currently exceeds the limit.
        Returns:
            (is_limited: bool, current_count: int, retry_after_seconds: int)
        """
        pass

    @abstractmethod
    def record_attempt(self, key: str, window_seconds: int) -> int:
        """
        Records a timestamped attempt without checking.
        """
        pass

    @abstractmethod
    def reset_attempts(self, key: str) -> None:
        """
        Clears all recorded attempts for the given key (for administrative/test cleanup).
        """
        pass

    @abstractmethod
    def cleanup_expired(self, older_than_seconds: int = 3600) -> int:
        """
        Purges stale rate limit records from storage.
        """
        pass


class DatabaseRateLimitStorage(BaseRateLimitStorage):
    """
    Shared atomic database storage for rate limiting.
    Works seamlessly across multiple Uvicorn workers and multi-instance container deployments on Render.
    Uses PostgreSQL advisory transaction locks (pg_advisory_xact_lock) or SQLite mutex serialization.
    """

    def __init__(self, session_factory=None, db_engine=None):
        self.session_factory = session_factory or SessionLocal
        self.engine = db_engine or engine
        self._sqlite_lock = threading.Lock()

        # Idempotently ensure the rate_limit_events table exists
        try:
            RateLimitEvent.__table__.create(bind=self.engine, checkfirst=True)
        except Exception as e:
            logger.warning(f"Could not verify rate_limit_events table: {e}")

    def atomic_check_and_record(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> Tuple[bool, int, int, Optional[int]]:
        now = time.time()
        cutoff = now - window_seconds

        with self._sqlite_lock:
            session: Session = self.session_factory()
            try:
                # In PostgreSQL, acquire a per-key advisory transaction lock to serialize
                # concurrent requests for the exact same rate-limit key across all workers/containers
                is_postgres = (
                    hasattr(self.engine, "dialect") and
                    self.engine.dialect.name == "postgresql"
                )
                if is_postgres:
                    session.execute(
                        text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                        {"key": key}
                    )

                # Opportunistic cleanup: remove expired rows for this key
                session.query(RateLimitEvent).filter(
                    RateLimitEvent.key == key,
                    RateLimitEvent.timestamp < cutoff
                ).delete(synchronize_session=False)

                # Query existing active attempts in sliding window
                records = session.query(RateLimitEvent.id, RateLimitEvent.timestamp).filter(
                    RateLimitEvent.key == key,
                    RateLimitEvent.timestamp >= cutoff
                ).order_by(RateLimitEvent.timestamp.asc()).all()

                count = len(records)
                if count >= limit:
                    # Limit exceeded: calculate accurate Retry-After based on oldest relevant attempt
                    oldest_ts = records[0][1]
                    retry_after = max(1, int(math.ceil(oldest_ts + window_seconds - now)))
                    session.commit()
                    return True, count, retry_after, None

                # Within quota: record the new attempt atomically
                event = RateLimitEvent(key=key, timestamp=now)
                session.add(event)
                session.commit()
                session.refresh(event)
                return False, count + 1, 0, event.id

            except Exception as e:
                session.rollback()
                raise RateLimitStorageError(
                    f"Database rate limit check-and-record error: {type(e).__name__}: {str(e)}"
                ) from e
            finally:
                session.close()

    def remove_attempt(self, key: str, attempt_id: Any) -> None:
        if attempt_id is None:
            return
        with self._sqlite_lock:
            session: Session = self.session_factory()
            try:
                session.query(RateLimitEvent).filter(
                    RateLimitEvent.id == attempt_id,
                    RateLimitEvent.key == key
                ).delete(synchronize_session=False)
                session.commit()
            except Exception as e:
                session.rollback()
                logger.warning(f"Failed to remove attempt {attempt_id} for {key}: {e}")
            finally:
                session.close()

    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int]:
        now = time.time()
        cutoff = now - window_seconds
        session: Session = self.session_factory()
        try:
            records = session.query(RateLimitEvent.timestamp).filter(
                RateLimitEvent.key == key,
                RateLimitEvent.timestamp >= cutoff
            ).order_by(RateLimitEvent.timestamp.asc()).all()

            count = len(records)
            if count >= limit:
                oldest_ts = records[0][0]
                retry_after = max(1, int(math.ceil(oldest_ts + window_seconds - now)))
                return True, count, retry_after

            return False, count, 0
        except Exception as e:
            raise RateLimitStorageError(f"Database rate limit query error: {type(e).__name__}: {str(e)}") from e
        finally:
            session.close()

    def record_attempt(self, key: str, window_seconds: int) -> int:
        now = time.time()
        cutoff = now - window_seconds
        with self._sqlite_lock:
            session: Session = self.session_factory()
            try:
                event = RateLimitEvent(key=key, timestamp=now)
                session.add(event)
                session.query(RateLimitEvent).filter(
                    RateLimitEvent.key == key,
                    RateLimitEvent.timestamp < cutoff
                ).delete(synchronize_session=False)
                session.commit()
                active_count = session.query(RateLimitEvent).filter(
                    RateLimitEvent.key == key,
                    RateLimitEvent.timestamp >= cutoff
                ).count()
                return active_count
            except Exception as e:
                session.rollback()
                raise RateLimitStorageError(f"Database rate limit record error: {type(e).__name__}: {str(e)}") from e
            finally:
                session.close()

    def reset_attempts(self, key: str) -> None:
        with self._sqlite_lock:
            session: Session = self.session_factory()
            try:
                session.query(RateLimitEvent).filter(RateLimitEvent.key == key).delete(synchronize_session=False)
                session.commit()
            except Exception as e:
                session.rollback()
                raise RateLimitStorageError(f"Database rate limit reset error: {type(e).__name__}: {str(e)}") from e
            finally:
                session.close()

    def cleanup_expired(self, older_than_seconds: int = 3600) -> int:
        cutoff = time.time() - older_than_seconds
        with self._sqlite_lock:
            session: Session = self.session_factory()
            try:
                deleted = session.query(RateLimitEvent).filter(
                    RateLimitEvent.timestamp < cutoff
                ).delete(synchronize_session=False)
                session.commit()
                return deleted
            except Exception as e:
                session.rollback()
                return 0
            finally:
                session.close()


class MemoryRateLimitStorage(BaseRateLimitStorage):
    """
    In-memory thread-safe sliding-window rate limit storage.
    Permitted ONLY in local development and testing environments.
    Strictly forbidden in production.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._events: Dict[str, List[Dict[str, Any]]] = {}

    def atomic_check_and_record(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> Tuple[bool, int, int, Optional[str]]:
        with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            existing = [ev for ev in self._events.get(key, []) if ev["ts"] >= cutoff]
            self._events[key] = existing

            count = len(existing)
            if count >= limit:
                oldest_ts = existing[0]["ts"]
                retry_after = max(1, int(math.ceil(oldest_ts + window_seconds - now)))
                return True, count, retry_after, None

            attempt_id = uuid.uuid4().hex
            existing.append({"id": attempt_id, "ts": now})
            self._events[key] = existing
            return False, count + 1, 0, attempt_id

    def remove_attempt(self, key: str, attempt_id: Any) -> None:
        if attempt_id is None:
            return
        with self._lock:
            existing = [ev for ev in self._events.get(key, []) if ev.get("id") != attempt_id]
            self._events[key] = existing

    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int]:
        with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            existing = [ev for ev in self._events.get(key, []) if ev["ts"] >= cutoff]
            self._events[key] = existing

            count = len(existing)
            if count >= limit:
                oldest_ts = existing[0]["ts"]
                retry_after = max(1, int(math.ceil(oldest_ts + window_seconds - now)))
                return True, count, retry_after

            return False, count, 0

    def record_attempt(self, key: str, window_seconds: int) -> int:
        with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            existing = [ev for ev in self._events.get(key, []) if ev["ts"] >= cutoff]
            existing.append({"id": uuid.uuid4().hex, "ts": now})
            self._events[key] = existing
            return len(existing)

    def reset_attempts(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def cleanup_expired(self, older_than_seconds: int = 3600) -> int:
        with self._lock:
            cutoff = time.time() - older_than_seconds
            removed = 0
            for k in list(self._events.keys()):
                kept = [ev for ev in self._events[k] if ev["ts"] >= cutoff]
                if not kept:
                    del self._events[k]
                    removed += 1
                else:
                    self._events[k] = kept
            return removed


REDIS_LUA_RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local cutoff = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local window = tonumber(ARGV[4])
local attempt_id = ARGV[5]

-- 1. Remove expired attempts outside sliding window
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

-- 2. Count active attempts within sliding window
local count = redis.call('ZCARD', key)

-- 3. Check if quota has been reached
if count >= limit then
    -- Over quota: extract timestamp of oldest active attempt to calculate exact Retry-After
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_score = cutoff
    if oldest and #oldest >= 2 then
        oldest_score = tonumber(oldest[2]) or cutoff
    end
    local retry_after = math.max(1, math.ceil(oldest_score + window - now))
    -- Return {is_limited=1, count, retry_after, ""}
    return {1, count, retry_after, ""}
else
    -- Below quota: atomically record attempt and refresh key TTL
    redis.call('ZADD', key, now, attempt_id)
    redis.call('EXPIRE', key, math.ceil(window * 2))
    -- Return {is_limited=0, new_count, retry_after=0, attempt_id}
    return {0, count + 1, 0, attempt_id}
end
"""


class RedisRateLimitStorage(BaseRateLimitStorage):
    """
    Redis sorted-set sliding window rate limit storage.
    Enforces atomic rate checks and recordings via single Lua script execution.
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            import redis
            self._client = redis.from_url(self.redis_url, decode_responses=True)
            return self._client
        except ImportError:
            raise RateLimitStorageError("The 'redis' package is required for Redis rate limiting but is not installed.")
        except Exception as e:
            raise RateLimitStorageError(f"Failed to connect to Redis rate limit backend: {e}") from e

    def atomic_check_and_record(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> Tuple[bool, int, int, Optional[str]]:
        client = self._get_client()
        now = time.time()
        cutoff = now - window_seconds
        redis_key = f"ratelimit:{key}"
        attempt_id = f"{now}:{uuid.uuid4().hex[:8]}"

        try:
            # Atomic evaluation via single Redis Lua script (guarantees isolation & prevents check-then-record races)
            res = client.eval(
                REDIS_LUA_RATE_LIMIT_SCRIPT,
                1,
                redis_key,
                str(now),
                str(cutoff),
                str(limit),
                str(window_seconds),
                attempt_id
            )

            is_limited = bool(int(res[0]) == 1)
            count = int(res[1])
            retry_after = int(res[2])
            recorded_id = str(res[3]) if res[3] else None

            if is_limited:
                return True, count, retry_after, None

            return False, count, 0, recorded_id or attempt_id
        except Exception as e:
            raise RateLimitStorageError(f"Redis rate limit atomic check error: {e}") from e

    def remove_attempt(self, key: str, attempt_id: Any) -> None:
        if not attempt_id:
            return
        try:
            client = self._get_client()
            client.zrem(f"ratelimit:{key}", str(attempt_id))
        except Exception as e:
            logger.warning(f"Failed to remove Redis attempt {attempt_id} for {key}: {e}")

    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int]:
        client = self._get_client()
        now = time.time()
        cutoff = now - window_seconds
        redis_key = f"ratelimit:{key}"

        try:
            pipeline = client.pipeline()
            pipeline.zremrangebyscore(redis_key, "-inf", cutoff)
            pipeline.zcard(redis_key)
            pipeline.zrange(redis_key, 0, 0, withscores=True)
            _, count, oldest = pipeline.execute()

            if count >= limit:
                oldest_score = oldest[0][1] if oldest else cutoff
                retry_after = max(1, int(math.ceil(oldest_score + window_seconds - now)))
                return True, count, retry_after

            return False, count, 0
        except Exception as e:
            raise RateLimitStorageError(f"Redis rate limit query error: {e}") from e

    def record_attempt(self, key: str, window_seconds: int) -> int:
        client = self._get_client()
        now = time.time()
        cutoff = now - window_seconds
        redis_key = f"ratelimit:{key}"
        member = f"{now}:{uuid.uuid4().hex[:6]}"

        try:
            pipeline = client.pipeline()
            pipeline.zremrangebyscore(redis_key, "-inf", cutoff)
            pipeline.zadd(redis_key, {member: now})
            pipeline.zcard(redis_key)
            pipeline.expire(redis_key, window_seconds * 2)
            _, _, count, _ = pipeline.execute()
            return count
        except Exception as e:
            raise RateLimitStorageError(f"Redis rate limit record error: {e}") from e

    def reset_attempts(self, key: str) -> None:
        client = self._get_client()
        redis_key = f"ratelimit:{key}"
        try:
            client.delete(redis_key)
        except Exception as e:
            raise RateLimitStorageError(f"Redis rate limit reset error: {e}") from e

    def cleanup_expired(self, older_than_seconds: int = 3600) -> int:
        return 0


# =====================================================================
# Trusted Proxy & Client IP Extraction Logic
# =====================================================================

def is_trusted_proxy(ip_str: str, trusted_proxies: Optional[List[str]] = None) -> bool:
    """
    Verifies whether an IP address belongs to the configured list of trusted proxies or CIDR subnets.
    """
    if not ip_str or not ip_str.strip():
        return False

    clean_ip = ip_str.strip()
    proxies = trusted_proxies if trusted_proxies is not None else settings.TRUSTED_PROXIES

    if clean_ip.lower() in [p.lower() for p in proxies]:
        return True

    try:
        parsed_ip = ipaddress.ip_address(clean_ip)
        for proxy in proxies:
            try:
                network = ipaddress.ip_network(proxy, strict=False)
                if parsed_ip in network:
                    return True
            except ValueError:
                continue
    except ValueError:
        return False

    return False


def get_client_ip(
    request: Request,
    trusted_proxies: Optional[List[str]] = None,
    trust_proxy_headers: Optional[bool] = None
) -> str:
    """
    Secure client IP extraction algorithm with strict anti-spoofing defense.

    Security & Anti-Spoofing Architecture:
    - If connecting peer is not in trusted_proxies, all forwarding headers (X-Forwarded-For,
      X-Render-Client-IP) are strictly ignored and request.client.host is returned directly.
      This completely prevents attackers from bypassing IP rate limits via fake headers.
    - If connecting peer is trusted (e.g. Render edge proxy), processes X-Render-Client-IP and
      X-Forwarded-For from right to left, picking the rightmost untrusted IP in the chain.

    Render Proxy Deployment Guidance:
    - On Render PaaS, traffic passes through internal reverse proxies before hitting the application.
    - While Render injects `X-Render-Client-IP` and `X-Forwarded-For`, the incoming TCP peer
      (`request.client.host`) depends on Render's internal overlay network routing.
    - Operators MUST verify the actual TCP peer IP in staging logs or health telemetry before
      hardcoding CIDRs in production. Do not blindly trust broad private ranges (like 10.0.0.0/8)
      without confirming Render's internal subnet for your service instance.
    - If `TRUST_PROXY_HEADERS` is false, `request.client.host` is used exclusively.
    """
    should_trust = trust_proxy_headers if trust_proxy_headers is not None else settings.TRUST_PROXY_HEADERS
    client_host = request.client.host if request.client else "127.0.0.1"

    if not should_trust or not client_host:
        return client_host or "127.0.0.1"

    # If the immediate TCP connection peer is not trusted, NEVER trust client-provided headers
    if not is_trusted_proxy(client_host, trusted_proxies):
        return client_host

    # Peer is a trusted reverse proxy (e.g. Render edge router)
    # Check X-Render-Client-IP (Render sets this directly on incoming requests)
    render_client_ip = request.headers.get("X-Render-Client-IP")
    if render_client_ip and render_client_ip.strip():
        clean_render_ip = render_client_ip.strip()
        try:
            ipaddress.ip_address(clean_render_ip)
            return clean_render_ip
        except ValueError:
            pass

    # Inspect X-Forwarded-For chain from right to left
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
        for ip in reversed(ips):
            try:
                ipaddress.ip_address(ip)
                if not is_trusted_proxy(ip, trusted_proxies):
                    return ip
            except ValueError:
                continue

    return client_host


# =====================================================================
# Rate Limiter Service
# =====================================================================

class RateLimiter:
    """
    High-level authentication rate limiter enforcing brute-force defenses on login and signup.
    Guarantees concurrency atomicity and prevents shared NAT reset attacks.
    """

    def __init__(self, storage: Optional[BaseRateLimitStorage] = None):
        self._storage = storage

    @property
    def storage(self) -> BaseRateLimitStorage:
        if self._storage is not None:
            return self._storage

        backend = settings.RATE_LIMIT_BACKEND.lower()
        if backend == "database":
            self._storage = DatabaseRateLimitStorage()
        elif backend == "memory":
            if settings.ENVIRONMENT in ("production", "prod"):
                raise RateLimitStorageError(
                    "CRITICAL: Memory rate limit backend is strictly forbidden in production mode."
                )
            self._storage = MemoryRateLimitStorage()
        elif backend == "redis":
            self._storage = RedisRateLimitStorage(settings.REDIS_URL)
        else:
            raise RateLimitStorageError(f"Unsupported rate limit backend: {backend}")

        return self._storage

    def _fail_safely_on_error(self, error: Exception, operation: str) -> None:
        """
        Fails closed in production if rate-limit storage is unavailable,
        preventing unmetered brute-force attacks when storage fails.
        """
        logger.error(f"Rate limiter storage error during {operation}: {error}")
        if settings.ENVIRONMENT in ("production", "prod"):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Authentication rate limit verification temporarily unavailable. Request blocked for security.",
                headers={"Retry-After": "60"}
            )

    def acquire_login_attempt(self, request: Request) -> Any:
        """
        Atomically checks and records an attempt for client IP.
        If the IP has exceeded maximum failed attempts within window, raises HTTP 429.
        Returns attempt_id to allow selective removal if credentials succeed.
        """
        client_ip = get_client_ip(request)
        key = f"login:{client_ip}"
        limit = settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS
        window = settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS

        try:
            is_limited, count, retry_after, attempt_id = self.storage.atomic_check_and_record(
                key, limit=limit, window_seconds=window
            )
            if is_limited:
                logger.warning(f"Brute-force protection: IP {client_ip} exceeded login rate limit ({count}/{limit}). Blocked.")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed login attempts. Please try again later.",
                    headers={"Retry-After": str(retry_after)}
                )
            return attempt_id
        except HTTPException:
            raise
        except Exception as e:
            self._fail_safely_on_error(e, "acquire_login_attempt")
            return None

    def release_successful_login(self, request: Request, attempt_id: Any) -> None:
        """
        Removes ONLY this successful attempt from storage so it is not counted as a failure.
        Previous failed attempts for this IP remain and will expire naturally through the sliding window,
        preventing shared NAT account reset exploits.
        """
        if attempt_id is None:
            return
        client_ip = get_client_ip(request)
        key = f"login:{client_ip}"
        try:
            self.storage.remove_attempt(key, attempt_id)
        except Exception as e:
            logger.warning(f"Failed to release successful login attempt {attempt_id} for {client_ip}: {e}")

    def enforce_signup_rate_limit(self, request: Request) -> None:
        """
        Atomically enforces signup rate limit against client IP to block registration spam and flooding.
        Applied via FastAPI dependency before schema validation so malformed requests cannot bypass.
        """
        client_ip = get_client_ip(request)
        key = f"signup:{client_ip}"
        limit = settings.RATE_LIMIT_SIGNUP_MAX_ATTEMPTS
        window = settings.RATE_LIMIT_SIGNUP_WINDOW_SECONDS

        try:
            is_limited, count, retry_after, _ = self.storage.atomic_check_and_record(
                key, limit=limit, window_seconds=window
            )
            if is_limited:
                logger.warning(f"Signup rate limit exceeded for IP {client_ip} ({count}/{limit}). Blocked.")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many signup attempts. Please try again later.",
                    headers={"Retry-After": str(retry_after)}
                )
        except HTTPException:
            raise
        except Exception as e:
            self._fail_safely_on_error(e, "enforce_signup_rate_limit")


_rate_limiter_instance: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Dependency provider returning singleton rate limiter instance."""
    global _rate_limiter_instance
    if _rate_limiter_instance is None:
        _rate_limiter_instance = RateLimiter()
    return _rate_limiter_instance


def rate_limit_signup_dependency(request: Request) -> None:
    """
    FastAPI route dependency that enforces signup rate limiting atomically
    prior to request body parsing and Pydantic validation.
    """
    limiter = get_rate_limiter()
    limiter.enforce_signup_rate_limit(request)
