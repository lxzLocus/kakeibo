-- チャットが会話から自動学習する「ユーザーメモリ」（永続的な事実・好み・方針）。
-- ユーザー1人につき1行。内容はLLMが会話から抽出・統合して更新する。
CREATE TABLE `user_memory` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `content` text,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_memory_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
