from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SystemJobLogOut(BaseModel):
    id: int
    job_type: str
    triggered_by: str | None
    started_at: datetime
    completed_at: datetime | None
    status: str
    records_in: int | None
    records_out: int | None
    error_detail: str | None

    model_config = ConfigDict(from_attributes=True)
