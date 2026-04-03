"""Registry of machine-readable `ERR_*` codes to HTTP status codes for API handlers."""

from __future__ import annotations

from typing import Final

# Add to error code registry / error handler
ERR_HTTP_STATUS: Final[dict[str, int]] = {
    # User management (C.4)
    "ERR_USER_NOT_FOUND": 404,
    "ERR_USER_USERNAME_DUPLICATE": 409,
    "ERR_USER_EMAIL_DUPLICATE": 409,
    "ERR_USER_MINISTRY_REQUIRED": 400,
}


def http_status_for_error_code(code: str, default: int = 500) -> int:
    """Return the registered HTTP status for `code`, or `default` if unknown."""
    return ERR_HTTP_STATUS.get(code, default)
