-- V4: クレジットカードの自動引き落とし（締め→引き落とし）と、固定費のカード払い
--
-- fund_pool（カード用の決済設定）:
--   closing_day        締め日 (1-31, null=月末)
--   payment_day        引き落とし日 (1-31)
--   settlement_pool_id 引き落とし元の口座（銀行）ID
--   auto_settle        自動引き落としを有効にするか
--
-- fund_transfer.auto_card_id : カード自動引き落としで生成した振替の対象カードID（冪等判定用）
-- fixed_cost.payment_pool_id : 固定費の支払い元プール（null=主口座、カードIDも可）

ALTER TABLE fund_pool
  ADD COLUMN closing_day INT NULL,
  ADD COLUMN payment_day INT NULL,
  ADD COLUMN settlement_pool_id BIGINT NULL,
  ADD COLUMN auto_settle BIT(1) NOT NULL DEFAULT b'0';

ALTER TABLE fund_transfer
  ADD COLUMN auto_card_id BIGINT NULL;

CREATE INDEX idx_transfer_auto_card ON fund_transfer (auto_card_id, transfer_date);

ALTER TABLE fixed_cost
  ADD COLUMN payment_pool_id BIGINT NULL;
