-- V3: 口座に種別と表示色を追加（クレジットカードを口座の一種として扱う）
--
-- kind : BANK(銀行) / CASH(現金) / CARD(クレジットカード)。既存口座は BANK 扱い。
-- color: カードのブランドカラー等の表示色（16進 or ラベル）。null は種別の既定色。

ALTER TABLE fund_pool
  ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'BANK',
  ADD COLUMN color VARCHAR(16) NULL;
