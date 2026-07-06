USE kakeibo;

CREATE TABLE IF NOT EXISTS user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'EXPENSE',   -- 収入(INCOME)/支出(EXPENSE) 区分
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_category_type (user_id, name, type)
);

CREATE TABLE IF NOT EXISTS store (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_store (user_id, name)
);

CREATE TABLE IF NOT EXISTS entry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category_id BIGINT NOT NULL,
    store_id BIGINT,
    type ENUM('INCOME', 'EXPENSE') NOT NULL,
    memo TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES category(id),
    FOREIGN KEY (store_id) REFERENCES store(id),
    INDEX idx_user_date (user_id, entry_date),
    INDEX idx_category (category_id),
    INDEX idx_store (store_id)
);

-- Phase 2: 食費機能

CREATE TABLE IF NOT EXISTS inventory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT '個',
    purchase_price DECIMAL(10, 2),
    purchase_date DATE,
    expiry_date DATE,
    storage ENUM('REFRIGERATED', 'FROZEN', 'ROOM_TEMP') DEFAULT 'REFRIGERATED',
    is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    INDEX idx_user_storage (user_id, storage),
    INDEX idx_expiry (user_id, expiry_date)
);

CREATE TABLE IF NOT EXISTS meal (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    meal_datetime DATETIME NOT NULL,
    meal_type ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK') NOT NULL,
    title VARCHAR(100) NOT NULL,
    servings INT NOT NULL DEFAULT 1,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, meal_datetime)
);

CREATE TABLE IF NOT EXISTS meal_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    meal_id BIGINT NOT NULL,
    inventory_id BIGINT NOT NULL,
    quantity_used DECIMAL(10, 2) NOT NULL,
    estimated_cost DECIMAL(10, 2),
    FOREIGN KEY (meal_id) REFERENCES meal(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id),
    INDEX idx_meal (meal_id)
);

-- ==========================================================
-- AI機能: ユーザ別APIキー / チャット / シミュレーション
-- ==========================================================

-- ユーザごとのLLM接続設定（APIキーは暗号化して保存）
-- purpose: 'CHAT'(テキスト対話) / 'VISION'(画像・OCR) で別プロバイダを設定可能
CREATE TABLE IF NOT EXISTS user_llm_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    purpose VARCHAR(16) NOT NULL DEFAULT 'CHAT',
    base_url VARCHAR(255) NOT NULL,
    model VARCHAR(100) NOT NULL,
    api_key_enc TEXT NOT NULL,
    supports_vision BOOLEAN NOT NULL DEFAULT FALSE,   -- 画像入力(Vision)対応か
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_purpose (user_id, purpose)
);

-- AIチャットのセッション
CREATE TABLE IF NOT EXISTS chat_session (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    INDEX idx_chat_user (user_id, updated_at)
);

-- AIチャットのメッセージ
CREATE TABLE IF NOT EXISTS chat_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    image_path VARCHAR(255) NULL,       -- 添付画像の保存ファイル名（./chat-uploads/）
    content_type VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_session(id) ON DELETE CASCADE,
    INDEX idx_message_session (session_id, created_at)
);

-- 貯蓄目標（シミュレーション用。1ユーザ1件）
CREATE TABLE IF NOT EXISTS goal (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    target_name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL,
    target_date DATE NOT NULL,
    current_savings DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 固定費（家賃・サブスクなど）
CREATE TABLE IF NOT EXISTS fixed_cost (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_day INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    INDEX idx_fixed_user (user_id)
);