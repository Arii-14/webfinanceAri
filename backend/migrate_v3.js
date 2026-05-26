const pool = require('./db');

async function migrate_v3() {
    try {
        console.log("Running migration v3...");

        // Journals Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS journals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                mood ENUM('sedih', 'senang', 'biasa') DEFAULT 'biasa',
                content TEXT,
                date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("✅ Table created: journals");

        console.log("Migration v3 complete.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}
migrate_v3();
