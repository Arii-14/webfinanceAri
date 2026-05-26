const pool = require('../db');
const { ADMIN_EMAIL } = require('../config/constants');

function isAdminEmail(email) {
  return normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function resolveUserRole(email, dbRole) {
  return isAdminEmail(email) ? 'admin' : 'user';
}

async function ensureSingleAdmin() {
  try {
    const adminNorm = normalizeEmail(ADMIN_EMAIL);
    await pool.query("UPDATE users SET role = 'user' WHERE LOWER(email) != ?", [
      adminNorm,
    ]);
    const [rows] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [
      adminNorm,
    ]);
    if (rows.length > 0) {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [rows[0].id]);
    }
  } catch (error) {
    console.error('Error in ensureSingleAdmin:', error);
    // Don't throw - allow server to continue
  }
}

module.exports = {
  ADMIN_EMAIL,
  isAdminEmail,
  normalizeEmail,
  resolveUserRole,
  ensureSingleAdmin,
};
