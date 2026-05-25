const pool = require('./db');

async function migrate_v2() {
    try {
        console.log("Running migration v2...");

        // Savings Goals Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS savings_goals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                name VARCHAR(100),
                target_amount DECIMAL(10,2),
                current_amount DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("✅ Table created: savings_goals");

        // Budgets Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS budgets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                category VARCHAR(50),
                limit_amount DECIMAL(10,2),
                month VARCHAR(7), -- Format: YYYY-MM
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_budget (user_id, category, month)
            )
        `);
        console.log("✅ Table created: budgets");

        // Subscriptions Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                name VARCHAR(100),
                amount DECIMAL(10,2),
                billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
                next_billing_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("✅ Table created: subscriptions");

        console.log("Migration v2 complete.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}
migrate_v2();
