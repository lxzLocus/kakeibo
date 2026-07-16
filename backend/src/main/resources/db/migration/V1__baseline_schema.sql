-- Flyway baseline (V1): 家計簿アプリの全スキーマ。
-- JPA エンティティから Hibernate が生成した DDL をそのまま採用しているため、
-- spring.jpa.hibernate.ddl-auto=validate と 1:1 で一致する。
-- 以降のスキーマ変更は V2__*.sql 以降を追加すること（この V1 は編集しない）。
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `category` (
  `sort_order` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('EXPENSE','INCOME') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKl31kxlkolvrrxa9c5xabw0hp5` (`user_id`,`name`,`type`),
  CONSTRAINT `FKpfk8djhv5natgshmxiav6xkpu` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `chat_message` (
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` bigint NOT NULL,
  `role` varchar(16) NOT NULL,
  `content` text NOT NULL,
  `content_type` varchar(255) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `chat_session` (
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `summarized_until_message_id` bigint DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `summary` text,
  `title` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `entry` (
  `amount` decimal(38,2) NOT NULL,
  `entry_date` date NOT NULL,
  `exclude_from_simulation` bit(1) NOT NULL,
  `category_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `fund_pool_id` bigint DEFAULT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `store_id` bigint DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `type` enum('EXPENSE','INCOME') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKf7mt5po7olj7eiwqlt6t3qc7j` (`category_id`),
  KEY `FK2b22ttoixy0iny85m063fhfw` (`store_id`),
  KEY `FKb8w0fw4ccf95p9ct3y2gn4nbq` (`user_id`),
  CONSTRAINT `FK2b22ttoixy0iny85m063fhfw` FOREIGN KEY (`store_id`) REFERENCES `store` (`id`),
  CONSTRAINT `FKb8w0fw4ccf95p9ct3y2gn4nbq` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
  CONSTRAINT `FKf7mt5po7olj7eiwqlt6t3qc7j` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `fixed_cost` (
  `amount` decimal(38,2) NOT NULL,
  `payment_day` int DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `fund_pool` (
  `initial_balance` decimal(15,2) NOT NULL,
  `is_primary` bit(1) NOT NULL,
  `sort_order` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `fund_transfer` (
  `amount` decimal(15,2) NOT NULL,
  `transfer_date` date NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `from_pool_id` bigint NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `to_pool_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `memo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `goal` (
  `current_savings` decimal(38,2) NOT NULL,
  `target_amount` decimal(38,2) NOT NULL,
  `target_date` date NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `target_name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK7b7j83l6dquot72lsg25y8323` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `inventory` (
  `expiry_date` date DEFAULT NULL,
  `is_consumed` bit(1) NOT NULL,
  `purchase_date` date DEFAULT NULL,
  `purchase_price` decimal(38,2) DEFAULT NULL,
  `quantity` decimal(38,2) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit` varchar(255) DEFAULT NULL,
  `storage` enum('FROZEN','REFRIGERATED','ROOM_TEMP') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK86u2qtuaxn5uph2u9olsxk2ic` (`user_id`),
  CONSTRAINT `FK86u2qtuaxn5uph2u9olsxk2ic` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `meal` (
  `servings` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `meal_datetime` datetime(6) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `meal_type` enum('BREAKFAST','DINNER','LUNCH','SNACK') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKckykxviti3jwd6vkcs55btrxa` (`user_id`),
  CONSTRAINT `FKckykxviti3jwd6vkcs55btrxa` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `meal_item` (
  `estimated_cost` decimal(38,2) DEFAULT NULL,
  `quantity_used` decimal(38,2) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `inventory_id` bigint NOT NULL,
  `meal_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKqbhvoiv9cxs463ft217fny2n0` (`inventory_id`),
  KEY `FKln67hf32oowp5ji5ee9mepp7q` (`meal_id`),
  CONSTRAINT `FKln67hf32oowp5ji5ee9mepp7q` FOREIGN KEY (`meal_id`) REFERENCES `meal` (`id`),
  CONSTRAINT `FKqbhvoiv9cxs463ft217fny2n0` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `shopping_item` (
  `checked` bit(1) NOT NULL,
  `estimated_price` int DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `store` (
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKnj4bk0h8lc4veb9it0i6k655p` (`user_id`,`name`),
  CONSTRAINT `FKn82wpcqrb21yddap4s3ttwnxj` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `user` (
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKob8kqyqqgmefl0aco34akdtpe` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `user_evaluation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `last_run_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `frequency` varchar(16) NOT NULL,
  `result_json` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK1h8ubg6r8xx2r0j3hbpxhky7c` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `user_llm_config` (
  `direct_ocr` bit(1) NOT NULL,
  `supports_vision` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `api_key_enc` text NOT NULL,
  `base_url` varchar(255) NOT NULL,
  `model` varchar(255) NOT NULL,
  `purpose` enum('CHAT','VISION') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_purpose` (`user_id`,`purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
