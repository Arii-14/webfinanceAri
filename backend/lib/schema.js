const pool = require('../db');

let schemaReady = null;

async function ensureSchema() {
    if (schemaReady) return schemaReady;
    schemaReady = (async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(60) NOT NULL,
                type ENUM('cash','bank','ewallet') DEFAULT 'cash',
                balance DECIMAL(14,2) NOT NULL DEFAULT 0,
                is_default TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_wallets_user (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS wallet_transfers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                from_wallet_id INT NOT NULL,
                to_wallet_id INT NOT NULL,
                amount DECIMAL(14,2) NOT NULL,
                date DATE NOT NULL,
                note VARCHAR(200) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_xfer_user_date (user_id, date),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_alert_prefs (
                user_id INT PRIMARY KEY,
                budget_on TINYINT(1) NOT NULL DEFAULT 1,
                subscription_on TINYINT(1) NOT NULL DEFAULT 1,
                savings_on TINYINT(1) NOT NULL DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS alert_sent_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                alert_key VARCHAR(80) NOT NULL,
                sent_on DATE NOT NULL,
                UNIQUE KEY uk_alert_once (user_id, alert_key, sent_on),
                INDEX idx_alert_cleanup (sent_on),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Kolom wallet_id di transactions (idempotent)
        const [cols] = await pool.query(
            `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'wallet_id'`
        );
        if (Number(cols[0].c) === 0) {
            await pool.query('ALTER TABLE transactions ADD COLUMN wallet_id INT NULL AFTER user_id');
            await pool.query('CREATE INDEX idx_tx_wallet ON transactions (wallet_id)');
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(50) NOT NULL,
                color CHAR(7) NOT NULL DEFAULT '#6366f1',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_user_cat (user_id, name),
                INDEX idx_cat_user (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS debts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                direction ENUM('owe','lent') NOT NULL,
                counterparty VARCHAR(80) NOT NULL,
                amount DECIMAL(14,2) NOT NULL,
                paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
                due_date DATE NULL,
                note VARCHAR(200) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_debts_user (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS debt_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                debt_id INT NOT NULL,
                amount DECIMAL(14,2) NOT NULL,
                paid_at DATE NOT NULL,
                note VARCHAR(120) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_debt_pay (debt_id),
                FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
            )
        `);
    })();
    return schemaReady;
}

module.exports = { ensureSchema };
