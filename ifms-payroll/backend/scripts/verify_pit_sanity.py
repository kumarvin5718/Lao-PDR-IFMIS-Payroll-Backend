#!/usr/bin/env python3
"""CLI sanity check for progressive PIT (`pit_calc`) vs expected GDT bracket totals.

Run from `backend/`: `PYTHONPATH=. python scripts/verify_pit_sanity.py`
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.utils.pit_calc import compute_pit_progressive  # noqa: E402


def _row(bracket_no: int, income_from: int, cumulative: int, rate_pct: float) -> SimpleNamespace:
    return SimpleNamespace(
        bracket_no=bracket_no,
        income_from_lak=income_from,
        cumulative_tax_lak=cumulative,
        rate_pct=rate_pct,
    )


def main() -> None:
    brackets = [
        _row(1, 0, 0, 0.0),
        _row(2, 1_300_000, 0, 5.0),
        _row(3, 5_000_000, 185_000, 10.0),
        _row(4, 12_000_000, 885_000, 15.0),
        _row(5, 25_000_000, 2_835_000, 20.0),
        _row(6, 65_000_000, 10_835_000, 24.0),
    ]
    assert compute_pit_progressive(brackets, Decimal("2000000"))[0] == Decimal("35000.00")
    assert compute_pit_progressive(brackets, Decimal("5000000"))[0] == Decimal("185000.00")
    assert compute_pit_progressive(brackets, Decimal("12000000"))[0] == Decimal("885000.00")
    pit66, no66 = compute_pit_progressive(brackets, Decimal("66000000"))
    assert no66 == 6
    assert pit66 == Decimal("11075000.00")
    print("verify_pit_sanity: OK")


if __name__ == "__main__":
    main()
