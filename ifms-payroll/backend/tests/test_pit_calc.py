"""Tests for `pit_calc.compute_pit_progressive` — bracket boundaries vs GDT/SRS expectations."""

from decimal import Decimal
from types import SimpleNamespace

from app.utils.pit_calc import compute_pit_progressive


def _bracket(no: int, income_from: int, cumulative: int, rate_pct: float) -> SimpleNamespace:
    return SimpleNamespace(
        bracket_no=no,
        income_from_lak=income_from,
        cumulative_tax_lak=cumulative,
        rate_pct=rate_pct,
    )


def test_pit_at_2m() -> None:
    brackets = [
        _bracket(1, 0, 0, 0),
        _bracket(2, 1_300_000, 0, 5),
        _bracket(3, 5_000_000, 185_000, 10),
    ]
    pit, no = compute_pit_progressive(brackets, Decimal("2000000"))
    assert no == 2
    assert pit == Decimal("35000.00")


def test_pit_at_5m_boundary() -> None:
    brackets = [
        _bracket(1, 0, 0, 0),
        _bracket(2, 1_300_000, 0, 5),
        _bracket(3, 5_000_000, 185_000, 10),
    ]
    pit, no = compute_pit_progressive(brackets, Decimal("5000000"))
    assert no == 3
    assert pit == Decimal("185000.00")


def test_pit_zero_or_negative() -> None:
    brackets = [_bracket(1, 0, 0, 0)]
    assert compute_pit_progressive(brackets, Decimal("0"))[0] == Decimal("0")
    assert compute_pit_progressive(brackets, Decimal("-100"))[0] == Decimal("0")
