"""Reseed lk_allowance_rates from MoF 4904/MOF (Dec 2025 indicative).

Run inside API container:
  python -m app.db.seeds.seed_allowance_rates

Uses TRUNCATE ... CASCADE — may truncate dependent rows in dev DB.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine, text

from app.config import get_settings

CIRCULAR_REF = "MoF No. 4904/MOF, 26 Dec 2025"
EFFECTIVE_FROM = date(2026, 1, 1)

ROWS: list[tuple[str, Decimal, str, str]] = [
    ("Salary Index Rate (ຄ່າດັດສະນີ — LAK per Index Point)", Decimal("10000"), "All Civil Servants", "Monetary rate per salary index point. Basic Salary = Grade/Step Index × this rate. Update when MoF issues revised ຄ່າດັດສະນີ circular. Current: 10,000 LAK/index point per MoF 4904/MOF indicative rate."),
    ("Position Allowance - General Staff", Decimal("900000"), "Technical and general civil servants without administrative position", "Professional/technical (general staff) allowance per MoF 4904/MOF. 900,000 LAK/person/month."),
    ("Position Allowance - Section Chief", Decimal("1500000"), "Section Chief / Type 3 administrative position", "Administrative position Type 3 per MoF 4904/MOF. 1,500,000 LAK/person/month."),
    ("Position Allowance - Division Chief", Decimal("1900000"), "Division Chief / Type 5 administrative position", "Administrative position Type 5 per MoF 4904/MOF. 1,900,000 LAK/person/month."),
    ("Position Allowance - Deputy Director", Decimal("2300000"), "Deputy Director / Type 7 administrative position", "Administrative position Type 7 per MoF 4904/MOF. 2,300,000 LAK/person/month."),
    ("Position Allowance - Director", Decimal("2500000"), "Department Director / Type 8 administrative position", "Administrative position Type 8 per MoF 4904/MOF. 2,500,000 LAK/person/month."),
    ("Position Allowance - Deputy Minister", Decimal("4000000"), "Deputy Minister / Grade 6 Step 2 leadership", "Grade 6 Step 2 leadership allowance per MoF 4904/MOF. 4,000,000 LAK/person/month."),
    ("Position Allowance - Minister", Decimal("9000000"), "Minister / Grade 6 Step 7 highest leadership", "Grade 6 Step 7 leadership allowance per MoF 4904/MOF. 9,000,000 LAK/person/month."),
    ("Years of Service Rate — 1 to 5 Years (LAK/year)", Decimal("10000"), "Staff with 1-5 completed years. Formula: years × 10,000 LAK/year.", "Per MoF 4904/MOF Sec 2.2.2. Rate of 10,000 LAK per year for first 5 years of service."),
    ("Years of Service Rate — 6 to 15 Years (LAK/year)", Decimal("20000"), "Staff with 6-15 completed years. Formula: years × 20,000 LAK/year.", "Per MoF 4904/MOF Sec 2.2.2. Rate of 20,000 LAK per year for years 6-15."),
    ("Years of Service Rate — 16 to 25 Years (LAK/year)", Decimal("30000"), "Staff with 16-25 completed years. Formula: years × 30,000 LAK/year.", "Per MoF 4904/MOF Sec 2.2.2. Rate of 30,000 LAK per year for years 16-25."),
    ("Years of Service Rate — 26+ Years (LAK/year)", Decimal("40000"), "Staff with 26 or more completed years. Formula: years × 40,000 LAK/year.", "Per MoF 4904/MOF Sec 2.2.2. Rate of 40,000 LAK per year for 26+ years."),
    ("Teaching Allowance Rate — % of Basic Salary", Decimal("0.20"), "Teachers (Field Allowance Type = Teaching). 20% of basic salary (secondary level default). Update for specific levels: Kindergarten/Primary=25%, Secondary=20%, Vocational=15%, Higher Ed=10%.", "Per MoF 4904/MOF Sec 2.2.3. Percentage of basic salary. Default: 20% (secondary). Formula in PAYROLL_CALC: Basic Salary × this rate."),
    ("Medical Personnel Allowance", Decimal("500000"), "Medical personnel providing medical services/treatment and diagnosis (MoH and equivalent).", "Per MoF 4904/MOF Sec 4. 500,000 LAK/person/month. Not paid if not performing duty."),
    ("National Assembly (NA) Member Allowance", Decimal("1000000"), "Elected National Assembly Members.", "Per MoF 4904/MOF Sec 5. 1,000,000 LAK/person/month for elected NA members."),
    ("Hardship and Hazardous Jobs Allowance", Decimal("1000000"), "Staff in designated hazardous roles per Instruction No. 127/MoF dated 14 Feb 1994.", "Per MoF 4904/MOF Sec 6. 1,000,000 LAK/person/month."),
    ("Remote / Difficult Area Allowance Rate — % of Basic Salary", Decimal("0.25"), "Staff in remote/difficult areas. Default Level 2: 25% of base salary. Level 1=30%, Level 2=25%, Level 3=20% per Decree 292/GoL dated 5 Apr 2021.", "Per MoF 4904/MOF Sec 7. Percentage of basic salary. Default Level 2 (25%). Formula: Basic Salary × this rate. Update to 0.30 or 0.20 for other levels."),
    ("Foreign Representative Living Allowance (LAK equivalent)", Decimal("20240000"), "Staff posted to Lao representative offices abroad. Actual amount in USD per position and area (see MoF 4904/MOF Sec 4 tables).", "Per MoF 4904/MOF Sec 4. Area 1 Second Secretary equivalent: USD 1,012 × 20,000 LAK/USD = 20,240,000 LAK. Update with actual USD rate × exchange rate per MFA directive."),
    ("Fuel Benefit — High Ranking Officials (Grade 6)", Decimal("0"), "Grade 6 leadership officials. Refer to Decree 599/GoL Sep 2021 and MoF Notification 2984/MoF Aug 2024.", "Per MoF 4904/MOF Sec 3.1. Follow Decree 599/GoL on State Vehicles. Amount per vehicle policy, not fixed cash."),
    ("Spouse Benefit", Decimal("200000"), "Married civil servants (Has Spouse = Yes).", "Per MoF 4904/MOF Sec 3.2. 200,000 LAK/person/month."),
    ("Child Benefit (per child, max 3)", Decimal("200000"), "Civil servants with eligible children (max 3).", "Per MoF 4904/MOF Sec 3.2. 200,000 LAK/person/month per eligible child. Maximum 3 children."),
    ("SSO Employee Contribution Rate (%)", Decimal("5.50"), "All permanent employees — percentage of Basic Salary.", "Employee mandatory SSO contribution. Rate per SSO/MLSW decree. Enter as plain number: 5.5 = 5.5%."),
    ("SSO Employer Contribution Rate (%)", Decimal("6.00"), "Government (employer) contribution — not deducted from employee salary.", "Reference only. Employer SSO contribution borne by government."),

]


def run() -> None:
    eng = create_engine(get_settings().alembic_database_url_sync)
    with eng.begin() as conn:
        conn.execute(text("TRUNCATE lk_allowance_rates RESTART IDENTITY CASCADE"))
        stmt = text(
            """
            INSERT INTO lk_allowance_rates (
              allowance_name, amount_or_rate, eligibility, description,
              effective_from, effective_to, circular_ref
            ) VALUES (
              :name, :amt, :elig, :desc, :eff, NULL, :circ
            )
            """
        )
        for name, amt, elig, desc in ROWS:
            conn.execute(
                stmt,
                {
                    "name": name,
                    "amt": amt,
                    "elig": elig,
                    "desc": desc,
                    "eff": EFFECTIVE_FROM,
                    "circ": CIRCULAR_REF,
                },
            )


if __name__ == "__main__":
    run()
