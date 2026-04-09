"""Populate rule_description on lk_grade_derivation (UPDATE only — no truncate).

Run inside API container:
  python -m app.db.seeds.seed_grade_derivation

Keys match current rows (education_level, exp_min_years). Extra tiers get
descriptions aligned to derived grade/step.
"""
from __future__ import annotations

from sqlalchemy import create_engine, text

from app.config import get_settings

# (education_level, exp_min_years, rule_description)
RULE_DESCRIPTIONS: list[tuple[str, int, str]] = [
    ("Bachelor", 0, "No experience: Grade 4 Step 1"),
    ("Bachelor", 5, "5+ years experience: Grade 4 Step 5"),
    ("Bachelor", 10, "10+ years experience: Grade 5 Step 1"),
    ("Bachelor", 20, "20+ years experience: Grade 6 Step 1"),
    ("Doctorate", 0, "No experience: Grade 5 Step 6"),
    ("Doctorate", 5, "5+ years experience: Grade 5 Step 7"),
    ("Lower Secondary", 0, "No experience: Grade 1 Step 5"),
    ("Lower Secondary", 5, "5+ years experience: Grade 2 Step 1"),
    ("Master", 0, "No experience: Grade 5 Step 1"),
    ("Master", 5, "5+ years experience: Grade 5 Step 5"),
    ("Master", 10, "10+ years experience: Grade 6 Step 5"),
    ("Primary", 0, "No experience: Grade 1 Step 1"),
    ("Primary", 5, "5+ years experience: Grade 1 Step 5"),
    ("Upper Secondary", 0, "No experience: Grade 2 Step 1"),
    ("Upper Secondary", 5, "5+ years experience: Grade 2 Step 5"),
    ("Upper Secondary", 10, "10+ years experience: Grade 3 Step 1"),
]


def main() -> None:
    engine = create_engine(get_settings().alembic_database_url_sync)
    with engine.begin() as conn:
        for edu, exp_min, descr in RULE_DESCRIPTIONS:
            conn.execute(
                text(
                    """
                    UPDATE lk_grade_derivation
                    SET rule_description = :descr
                    WHERE education_level = :edu AND exp_min_years = :exp_min
                    """
                ),
                {"descr": descr, "edu": edu, "exp_min": exp_min},
            )


if __name__ == "__main__":
    main()
