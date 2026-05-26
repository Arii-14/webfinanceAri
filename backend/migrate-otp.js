const pool = require('./db');
const { ensureSingleAdmin } = require('./lib/adminPolicy');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        attempts INT DEFAULT 0,
        expires_at DATETIME NOT NULL,
        locked_until DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_expires (expires_at)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS registration_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        attempts INT DEFAULT 0,
        expires_at DATETIME NOT NULL,
        locked_until DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reg_email (email),
        INDEX idx_reg_expires (expires_at)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_ip (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        endpoint VARCHAR(64) NOT NULL,
        hit_count INT DEFAULT 1,
        window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        locked_until DATETIME NULL,
        UNIQUE KEY uk_ip_endpoint (ip_address, endpoint)
      )
    `);

    await ensureSingleAdmin();
    console.log('Migration OTP & admin policy selesai.');
    process.exit(0);
  } catch (e) {
    console.error('Migration gagal:', e);
    process.exit(1);
  }
}

migrate();
