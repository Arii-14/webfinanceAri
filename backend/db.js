const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let sslOptions = undefined;
if (process.env.DB_SSL_CA) {
    let caPath = process.env.DB_SSL_CA;
    // Fallback if path doesn't exist, check local ca.pem
    if (!fs.existsSync(caPath)) {
        caPath = path.join(__dirname, '../ca.pem');
    }
    
    if (fs.existsSync(caPath)) {
        sslOptions = {
            ca: fs.readFileSync(caPath),
            rejectUnauthorized: true
        };
    } else {
        console.warn("SSL CA file not found at " + caPath + ", proceeding without SSL.");
    }
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslOptions,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
