"""Unit tests for `payroll_calculator` — gross, deductions, net, YoS/PIT-related helpers."""

from datetime import date
from decimal import Decimal

import pytest

from app.services.payroll_calculator import (
    basic_salary_lak,
    employee_sso_lak,
    gross_earnings_lak,
    housing_transport_from_fuel,
    lak,
    net_salary_lak,
    taxable_income_lak,
    total_allowances_lak,
    total_deductions_lak,
    years_completed_as_of,
    yos_allowance_lak,
    yos_band_rate_name_for_years,
)


def test_lak_rounds_half_up() -> None:
    assert lak(Decimal("100.4")) == Decimal("100")
    assert lak(Decimal("100.5")) == Decimal("101")


def test_years_completed_as_of() -> None:
    join = date(2020, 3, 15)
    assert years_completed_as_of(join, date(2025, 3, 1)) == 4
    assert years_completed_as_of(join, date(2025, 4, 1)) == 5
    assert years_completed_as_of(date(2026, 2, 1), date(2025, 3, 1)) == 0


def test_yos_band_name() -> None:
    assert "1 to 5" in yos_band_rate_name_for_years(3)
    assert "6 to 15" in yos_band_rate_name_for_years(10)
    assert "26+" in yos_band_rate_name_for_years(30)


def test_yos_allowance_lak() -> None:
    assert yos_allowance_lak(5, Decimal("10000")) == Decimal("50000")
    assert yos_allowance_lak(0, Decimal("10000")) == Decimal("0")


def test_basic_and_sso() -> None:
    b = basic_salary_lak(25, Decimal("10000"))
    assert b == Decimal("250000")
    assert employee_sso_lak(b) == lak(b * Decimal("0.055"))


def test_gross_taxable_net() -> None:
    basic = Decimal("2000000")
    std = Decimal("500000")
    g = gross_earnings_lak(basic, std, Decimal("0"), Decimal("0"), Decimal("0"))
    assert g == Decimal("2500000")
    sso = employee_sso_lak(basic)
    tax = taxable_income_lak(g, sso)
    assert tax == lak(g - sso)
    pit = Decimal("100000.00")
    net = net_salary_lak(g, sso, pit, Decimal("0"), Decimal("0"))
    assert net == lak(g - sso - pit)


def test_total_allowances_and_deductions() -> None:
    assert total_allowances_lak(Decimal("100"), Decimal("1"), Decimal("2"), Decimal("3")) == Decimal("106")
    assert total_deductions_lak(Decimal("10"), Decimal("5"), Decimal("1"), Decimal("2")) == Decimal("18")


@pytest.mark.parametrize(
    "fuel,housing,transport,expect_h,expect_t",
    [
        (Decimal("300000"), Decimal("200000"), Decimal("100000"), Decimal("200000"), Decimal("100000")),
        (Decimal("0"), Decimal("100"), Decimal("100"), Decimal("0"), Decimal("0")),
    ],
)
def test_housing_transport_from_fuel(
    fuel: Decimal,
    housing: Decimal,
    transport: Decimal,
    expect_h: Decimal,
    expect_t: Decimal,
) -> None:
    h, t = housing_transport_from_fuel(fuel, housing, transport)
    assert h == expect_h
    assert t == expect_t
