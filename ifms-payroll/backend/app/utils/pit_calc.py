"""GDT progressive PIT — SRS §8.9 (cumulative_tax_lak + marginal rate on excess)."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal


def pit_lak(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_pit_progressive(
    brackets: list,
    taxable_income: Decimal,
) -> tuple[Decimal, int]:
    """Pick highest bracket where income >= income_from (reverse bracket_no order)."""
    if not brackets:
        return Decimal("0"), 1
    ti = taxable_income
    if ti <= 0:
        return Decimal("0"), 1
    for bracket in reversed(brackets):
        from_lak = Decimal(str(bracket.income_from_lak))
        if ti >= from_lak:
            cum = Decimal(str(bracket.cumulative_tax_lak))
            rate = Decimal(str(bracket.rate_pct)) / Decimal("100")
            excess = ti - from_lak
            pit = cum + excess * rate
            return pit_lak(pit), int(bracket.bracket_no)
    return Decimal("0"), 1
