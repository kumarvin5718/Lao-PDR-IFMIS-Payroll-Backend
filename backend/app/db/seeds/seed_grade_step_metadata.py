"""Backfill lk_grade_step toolkit metadata (dates, circular ref, notes).

Run inside API container after deploy:
  python -m app.db.seeds.seed_grade_step_metadata

Idempotent UPDATE — safe to re-run.
"""
from __future__ import annotations

from sqlalchemy import create_engine, text

from app.config import get_settings

SQL = """
UPDATE lk_grade_step SET
  effective_from    = DATE '2026-01-01',
  effective_to      = NULL,
  last_updated      = DATE '2025-12-26',
  last_updated_by   = 'SEED_INIT',
  circular_ref      = 'MoF No. 4904/MOF, 26 Dec 2025',
  notes             = 'Basic salary = Grade/Step Index × Salary Index Rate (LAK per index point). MoF 4904/MOF.',
  change_remarks    = NULL
WHERE TRUE
"""


def main() -> None:
    engine = create_engine(get_settings().alembic_database_url_sync)
    with engine.begin() as conn:
        conn.execute(text(SQL))


if __name__ == "__main__":
    main()
