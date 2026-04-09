"""Bind generated report filenames under REPORTS_DIR to the user who requested the export (Valkey TTL)."""

from __future__ import annotations

import logging

import redis

from app.config import get_settings

logger = logging.getLogger("ifms.reports")

KEY_PREFIX = "report_file_owner:"
DEFAULT_TTL_SECONDS = 3600


def register_report_file_owner(filename: str, user_id: str, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
    """Sync: call from Celery workers after writing a file to REPORTS_DIR."""
    basename = filename.split("/")[-1].split("\\")[-1]
    if not basename:
        return
    try:
        settings = get_settings()
        r = redis.from_url(settings.VALKEY_URL, decode_responses=True)
        r.setex(f"{KEY_PREFIX}{basename}", ttl_seconds, user_id)
    except Exception as exc:
        logger.warning("report download registry unavailable: %s", exc)
