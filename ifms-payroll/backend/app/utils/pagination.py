"""Helpers to build `PaginatedResponse` metadata from page/limit/total."""

from math import ceil

from app.schemas.common import PaginatedResponse


def paginated_response(page: int, limit: int, total: int) -> PaginatedResponse:
    pages = ceil(total / limit) if limit else 0
    return PaginatedResponse(page=page, limit=limit, total=total, pages=pages)
