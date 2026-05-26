const bcrypt = require('bcryptjs');
const pool = require('./db');

async function setupAndSeed() {
    try {
        console.log("Setting up database tables if they don't exist...");
        
        // Users Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50),
                email VARCHAR(100),
                password VARCHAR(255),
                role ENUM('admin', 'user') DEFAULT 'user',
                profile_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Transactions Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                type ENUM('income', 'expense'),
                amount DECIMAL(10,2),
                category VARCHAR(50),
                date DATE,
                note TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Seed accounts
        const { ensureSingleAdmin, ADMIN_EMAIL } = require('./lib/adminPolicy');

        const adminPass = await bcrypt.hash('admin123', 10);
        const userPass = await bcrypt.hash('user123', 10);

        const [existingAdmin] = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [ADMIN_EMAIL]);
        if (existingAdmin.length === 0) {
            await pool.query(
                'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                ['Muhammad Apriyanda', ADMIN_EMAIL, adminPass, 'admin']
            );
            console.log(`✅ Admin account created: email=${ADMIN_EMAIL}, pass=admin123`);
        } else {
            await pool.query("UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER(?)", [ADMIN_EMAIL]);
            console.log(`✅ Admin account exists: ${ADMIN_EMAIL}`);
        }

        await ensureSingleAdmin();

        const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', ['user@mail.com']);
        if (existingUser.length === 0) {
            await pool.query(
                'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                ['user_biasa', 'user@mail.com', userPass, 'user']
            );
            console.log('✅ User account created: email=user@mail.com, pass=user123');
        } else {
            console.log('✅ User account already exists.');
        }

        console.log("Setup & Seeding complete.");
        process.exit(0);
    } catch (e) {
        console.error("Error setting up DB:", e);
        process.exit(1);
    }
}

setupAndSeed();
