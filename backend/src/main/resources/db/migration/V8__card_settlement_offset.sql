-- カードの引き落としタイミング。0=デフォルト（翌月）、1=翌々月。
ALTER TABLE fund_pool ADD COLUMN settlement_offset_months int NOT NULL DEFAULT 0;
