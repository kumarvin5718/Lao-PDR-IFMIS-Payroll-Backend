from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LkLocationMaster(Base):
    __tablename__ = "lk_location_master"

    province: Mapped[str] = mapped_column(String(60), primary_key=True)
    country: Mapped[str] = mapped_column(String(30), nullable=False)
    province_key: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    district: Mapped[str] = mapped_column(String(60), nullable=False)
    is_remote: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_hazardous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(String(200))
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    last_updated: Mapped[date | None] = mapped_column(Date)
    last_updated_by: Mapped[str | None] = mapped_column(String(80))
    circular_ref: Mapped[str | None] = mapped_column(String(80))
    change_remarks: Mapped[str | None] = mapped_column(String(200))
