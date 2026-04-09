"""Bulk upload session confirmation payloads (minimal)."""

from pydantic import BaseModel


class UploadConfirmBody(BaseModel):
    """TODO: bulk upload confirm body."""
    session_id: str | None = None
