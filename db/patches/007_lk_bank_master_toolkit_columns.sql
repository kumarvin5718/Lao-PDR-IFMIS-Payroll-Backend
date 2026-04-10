-- LK_BankMaster — LaoPayrollToolkit v5 LK_BankMaster tab fields
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS category varchar(120);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS bank_abbrev varchar(20);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS city varchar(100);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS branch_address varchar(500);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS bank_hq_address varchar(500);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS telephone varchar(80);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS ownership varchar(300);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS established varchar(30);
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS website varchar(300);
