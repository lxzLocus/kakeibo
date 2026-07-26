-- カテゴリのグループ（プライマリカテゴリ）。NULL は「未分類」。
-- グループ自体はエンティティを持たず、この文字列でセレクターの optgroup を作る。
ALTER TABLE category ADD COLUMN group_name VARCHAR(255) NULL;
