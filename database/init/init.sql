USE kakeibo;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entry_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    memo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

# 初期データの挿入
INSERT INTO users (id, username, password_hash, created_at)
VALUES
    (1, 'testuser', 'hashed_password_example', CURRENT_TIMESTAMP),
    (2, 'alice', 'hashed_password_example2', CURRENT_TIMESTAMP),
    (3, 'bob', 'hashed_password_example3', CURRENT_TIMESTAMP);


INSERT INTO entries (user_id, entry_date, amount, category, type, memo, created_at)
VALUES
    (1, '2024-01-01', 1000.00, 'Salary', 'income', 'January salary', CURRENT_TIMESTAMP),
    (1, '2024-01-05', 50.00, 'Groceries', 'expense', 'Weekly groceries', CURRENT_TIMESTAMP),
    (2, '2024-01-03', 200.00, 'Freelance', 'income', 'Project payment', CURRENT_TIMESTAMP),
    (2, '2024-01-07', 30.00, 'Transport', 'expense', 'Bus ticket', CURRENT_TIMESTAMP),
    (3, '2024-01-02', 1500.00, 'Salary', 'income', 'January salary', CURRENT_TIMESTAMP),
    (3, '2024-01-06', 100.00, 'Dining', 'expense', 'Dinner with friends', CURRENT_TIMESTAMP);
