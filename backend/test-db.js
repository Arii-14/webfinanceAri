const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('./db');

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    const [rows] = await pool.query('SELECT 1 as test');
    console.log('Database connection successful:', rows);
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testDatabase();
