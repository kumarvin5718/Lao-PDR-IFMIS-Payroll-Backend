#!/usr/bin/env python3
"""Create all ORM tables in the database (development / empty DB).

The SQL files under db/init/ are largely placeholders; if `employee` and lookup
tables are missing, API routes such as GET /employees will return 500.

Run from `backend/` with DATABASE_URL set (same as the API):

  cd backend && PYTHONPATH=. python scripts/create_dev_tables.py

In Docker (cwd irrelevant):

  docker compose exec api python scripts/create_dev_tables.py

Requires: psycopg2 (postgresql+psycopg2 URL derived from DATABASE_URL).
"""

from __future__ import annotations

import sys
from pathlib import Path

# Running `python scripts/foo.py` puts the script dir on sys.path, not the repo root — ensure `app` resolves.
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from sqlalchemy import create_engine

from app.config import get_settings
from app.database import Base

# Register all models on Base.metadata
import app.models  # noqa: F401


def main() -> None:
    settings = get_settings()
    url = settings.database_url_sync
    engine = create_engine(url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine, checkfirst=True)
    print("create_all completed (checkfirst=True).")


if __name__ == "__main__":
    main()
