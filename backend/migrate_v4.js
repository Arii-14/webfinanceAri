const pool = require('./db');

async function migrate_v4() {
    try {
        console.log("Running migration v4...");

        // User Accounts Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                name VARCHAR(255) NOT NULL,
                type ENUM('Website', 'Game', 'APK') NOT NULL,
                login_via VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("✅ Table created: user_accounts");

        console.log("Migration v4 complete.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}
migrate_v4();
