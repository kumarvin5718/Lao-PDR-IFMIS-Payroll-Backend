"""SlowAPI limiter (login brute-force mitigation). Uses X-Forwarded-For when behind nginx."""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def rate_limit_key(request: Request) -> str:
    """Client IP: first X-Forwarded-For hop when present, else direct remote."""
    xf = request.headers.get("x-forwarded-for")
    if xf:
        return xf.split(",")[0].strip()[:200]
    return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key)
