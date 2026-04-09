"""Async Valkey/Redis client for caching (e.g. Superset admin JWT)."""

from __future__ import annotations

import redis.asyncio as redis

from app.config import get_settings

_client: redis.Redis | None = None


async def _ensure_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(
            get_settings().VALKEY_URL,
            decode_responses=True,
        )
    return _client


class ValkeyClient:
    async def get(self, key: str) -> str | None:
        r = await _ensure_client()
        return await r.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        r = await _ensure_client()
        await r.set(key, value, ex=ex)


valkey_client = ValkeyClient()


async def get_report_file_owner(filename: str) -> str | None:
    """Return app_user.user_id that owns this REPORTS_DIR basename, if registered."""
    basename = filename.split("/")[-1].split("\\")[-1]
    if not basename:
        return None
    r = await _ensure_client()
    return await r.get(f"report_file_owner:{basename}")


async def invalidate_dashboard_cache() -> None:
    """Remove all cached dashboard API payloads (e.g. after payroll run)."""
    r = await _ensure_client()
    keys: list[str] = []
    async for key in r.scan_iter(match="dashboard:*"):
        keys.append(key)
    if keys:
        await r.delete(*keys)
