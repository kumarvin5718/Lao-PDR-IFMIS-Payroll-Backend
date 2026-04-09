-- Align lk_pit_brackets.income_from_lak with SRS §8.9 cumulative formula + GDT seed.
-- Apply after initial seed if rows still use 1300001 / 5000001 / … thresholds.
UPDATE lk_pit_brackets SET income_from_lak = 1300000 WHERE bracket_no = 2;
UPDATE lk_pit_brackets SET income_from_lak = 5000000 WHERE bracket_no = 3;
UPDATE lk_pit_brackets SET income_from_lak = 12000000 WHERE bracket_no = 4;
UPDATE lk_pit_brackets SET income_from_lak = 25000000 WHERE bracket_no = 5;
UPDATE lk_pit_brackets SET income_from_lak = 65000000 WHERE bracket_no = 6;
