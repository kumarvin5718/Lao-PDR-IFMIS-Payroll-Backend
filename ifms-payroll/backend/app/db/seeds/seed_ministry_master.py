"""Seed lk_ministry_master (MoF circular list).

Run:
  docker compose exec api python -m app.db.seeds.seed_ministry_master
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import create_engine, text

from app.config import get_settings

ROWS: list[tuple[str, str, str | None, bool, str | None]] = [
    ("MOF", "Ministry of Finance (MoF)", "Finance", False, None),
    ("MOH", "Ministry of Health (MoH)", "Medical", False, "Medical"),
    ("MOES", "Ministry of Education and Sports (MoES)", "Teacher", False, "Teaching"),
    ("MOHA", "Ministry of Home Affairs (MoHA)", "Administration", False, None),
    ("MFA", "Ministry of Foreign Affairs (MFA)", "Diplomatic", False, None),
    ("MLSW", "Ministry of Labour & Social Welfare (MLSW)", "Administration", False, None),
    ("MOAF", "Ministry of Agriculture and Forestry (MoAF)", "Technical", False, None),
    ("MOIC", "Ministry of Industry & Commerce (MoIC)", "Administration", False, None),
    ("MOJ", "Ministry of Justice (MoJ)", "Legal", False, None),
    ("MONRE", "Ministry of Natural Resources & Environment (MoNRE)", "Technical", False, None),
    ("MPI", "Ministry of Planning & Investment (MPI)", "Administration", False, None),
    ("MPWT", "Ministry of Public Works & Transport (MPWT)", "Technical", False, None),
    ("VTCAP", "Vientiane Capital Administration", "Administration", False, None),
    ("SAVAN", "Savannakhet Province Administration", "Administration", False, None),
    ("CHAM", "Champasak Province Administration", "Administration", False, None),
    ("LUANGPB", "Luang Prabang Province Administration", "Administration", False, None),
    ("KHAMM", "Khammuane Province Administration", "Administration", False, None),
    ("NA", "National Assembly (NA)", "Administration", True, None),
]

CIRCULAR = "MoF No. 4904/MOF, 26 Dec 2025"
EFF = date(2026, 1, 1)


def main() -> None:
    settings = get_settings()
    engine = create_engine(settings.alembic_database_url_sync)
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE lk_ministry_master RESTART IDENTITY CASCADE"))
        for key, name, prof, na_elig, field in ROWS:
            conn.execute(
                text(
                    """
                    INSERT INTO lk_ministry_master (
                      ministry_key, ministry_name, profession_category,
                      na_allowance_eligible, field_allowance_type,
                      effective_from, effective_to, circular_ref
                    ) VALUES (
                      :k, :n, :p, :na, :f, :ef, NULL, :c
                    )
                    """
                ),
                {
                    "k": key,
                    "n": name,
                    "p": prof,
                    "na": na_elig,
                    "f": field,
                    "ef": EFF,
                    "c": CIRCULAR,
                },
            )
    print(f"Seeded {len(ROWS)} rows into lk_ministry_master.")


if __name__ == "__main__":
    main()
