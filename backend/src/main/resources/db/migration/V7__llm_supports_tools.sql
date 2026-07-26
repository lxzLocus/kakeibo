-- モデルが関数呼び出し(tools)に対応するかの自動判定結果キャッシュ。
-- NULL=未判定（初回チャットで tools 付き実行を試し、成否から自動でtrue/falseを記録する）。
ALTER TABLE `user_llm_config` ADD COLUMN `supports_tools` bit(1) DEFAULT NULL;
