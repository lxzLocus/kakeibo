-- V2: 固定費の毎月自動記帳（収支への自動追加）
--
-- fixed_cost: 自動記帳の有効フラグと、記帳先カテゴリを持たせる。
-- entry:      記帳元の固定費IDを持たせ、「同じ固定費を同じ月に二重記帳しない」判定に使う。
--
-- 注意: 自動記帳されたエントリは exclude_from_simulation = 1 で作成する。
--       シミュレーションは固定費を別枠(fixedExpense)で加算しているため、
--       エントリ側も学習に含めると二重計上になるため。

ALTER TABLE fixed_cost
  ADD COLUMN auto_post BIT(1) NOT NULL DEFAULT b'0',
  ADD COLUMN category_id BIGINT NULL;

ALTER TABLE entry
  ADD COLUMN fixed_cost_id BIGINT NULL;

CREATE INDEX idx_entry_fixed_cost ON entry (fixed_cost_id, entry_date);
