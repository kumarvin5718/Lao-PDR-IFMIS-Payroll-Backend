"""Pure payroll arithmetic (SRS §8.x) — no DB / I/O."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from dateutil.relativedelta import relativedelta

# SRS §8.4 — lk_allowance_rates.allowance_name keys for YoS bands
YOS_RATE_NAMES = (
    "Years of Service Rate — 1 to 5 Years (LAK/year)",
    "Years of Service Rate — 6 to 15 Years (LAK/year)",
    "Years of Service Rate — 16 to 25 Years (LAK/year)",
    "Years of Service Rate — 26+ Years (LAK/year)",
)


def lak(v: Decimal) -> Decimal:
    """Round to whole LAK (payroll amounts except PIT)."""
    return v.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def years_completed_as_of(date_of_joining: date, payroll_month_first: date) -> int:
    """Completed calendar years from join to payroll month start (first day)."""
    if date_of_joining > payroll_month_first:
        return 0
    return relativedelta(payroll_month_first, date_of_joining).years


def yos_allowance_lak(years: int, rate_lak_per_year: Decimal) -> Decimal:
    """SRS §8.4: completed years × band rate (LAK/year)."""
    if years <= 0:
        return Decimal("0")
    return lak(Decimal(years) * rate_lak_per_year)


def allowance_rate_kind(allowance_name: str | None, eligibility: str | None) -> str:
    """Return FLAT (fixed LAK/month or LAK/year band) vs PCT (fraction of basic salary).

    Legacy rows may prefix eligibility with TYPE:PCT. MoF 4904 %-of-basic rows are detected by name.
    """
    e = (eligibility or "").strip()
    if e.upper().startswith("TYPE:PCT"):
        return "PCT"
    n = allowance_name or ""
    if "% of Basic Salary" in n:
        return "PCT"
    return "FLAT"


def yos_band_rate_name_for_years(years: int) -> str:
    """Resolve lk_allowance_rates row name for completed years."""
    if years <= 0:
        return YOS_RATE_NAMES[0]
    if years <= 5:
        return YOS_RATE_NAMES[0]
    if years <= 15:
        return YOS_RATE_NAMES[1]
    if years <= 25:
        return YOS_RATE_NAMES[2]
    return YOS_RATE_NAMES[3]


def basic_salary_lak(grade_step_index: int, salary_index_rate: Decimal) -> Decimal:
    """SRS §8.2: index × salary index rate (LAK per index point)."""
    return lak(Decimal(grade_step_index) * salary_index_rate)


def gross_earnings_lak(
    basic: Decimal,
    std_allowances_sum: Decimal,
    free_a1: Decimal,
    free_a2: Decimal,
    free_a3: Decimal,
) -> Decimal:
    return lak(basic + std_allowances_sum + free_a1 + free_a2 + free_a3)


def employee_sso_lak(basic: Decimal) -> Decimal:
    return lak(basic * Decimal("0.055"))


def employer_sso_lak(basic: Decimal) -> Decimal:
    return lak(basic * Decimal("0.06"))


def taxable_income_lak(gross: Decimal, employee_sso: Decimal) -> Decimal:
    return lak(gross - employee_sso)


def net_salary_lak(
    gross: Decimal,
    employee_sso: Decimal,
    pit: Decimal,
    free_d1: Decimal,
    free_d2: Decimal,
) -> Decimal:
    return lak(gross - employee_sso - pit - free_d1 - free_d2)


def total_allowances_lak(
    std_sum: Decimal,
    free_a1: Decimal,
    free_a2: Decimal,
    free_a3: Decimal,
) -> Decimal:
    return lak(std_sum + free_a1 + free_a2 + free_a3)


def total_deductions_lak(
    employee_sso: Decimal,
    pit: Decimal,
    free_d1: Decimal,
    free_d2: Decimal,
) -> Decimal:
    return lak(employee_sso + pit + free_d1 + free_d2)


def housing_transport_from_fuel(
    fuel_stored: Decimal,
    housing_recalc: Decimal,
    transport_recalc: Decimal,
) -> tuple[Decimal, Decimal]:
    """Split stored fuel (housing+transport) for display when recalc sum matches."""
    combined = lak(housing_recalc + transport_recalc)
    if combined == Decimal("0"):
        return housing_recalc, transport_recalc
    if fuel_stored == combined:
        return housing_recalc, transport_recalc
    if fuel_stored <= Decimal("0"):
        return Decimal("0"), Decimal("0")
    ratio = fuel_stored / combined
    return lak(housing_recalc * ratio), lak(transport_recalc * ratio)
