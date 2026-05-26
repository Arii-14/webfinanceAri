const pool = require('../db');
const {
  IP_RATE_LIMIT_MAX,
  IP_RATE_LIMIT_WINDOW_MINUTES,
} = require('../config/constants');

async function checkIpRateLimit(ip, endpoint) {
  const windowMinutes = IP_RATE_LIMIT_WINDOW_MINUTES;
  const [rows] = await pool.query(
    'SELECT * FROM rate_limit_ip WHERE ip_address = ? AND endpoint = ?',
    [ip, endpoint]
  );

  const now = new Date();

  if (rows.length === 0) {
    await pool.query(
      'INSERT INTO rate_limit_ip (ip_address, endpoint, hit_count, window_start) VALUES (?, ?, 1, NOW())',
      [ip, endpoint]
    );
    return { allowed: true };
  }

  const row = rows[0];

  if (row.locked_until && new Date(row.locked_until) > now) {
    const minutesLeft = Math.ceil((new Date(row.locked_until) - now) / 60000);
    return {
      allowed: false,
      message: `Terlalu banyak permintaan. Coba lagi dalam ${minutesLeft} menit.`,
    };
  }

  const windowStart = new Date(row.window_start);
  const windowMs = windowMinutes * 60 * 1000;

  if (now - windowStart > windowMs) {
    await pool.query(
      'UPDATE rate_limit_ip SET hit_count = 1, window_start = NOW(), locked_until = NULL WHERE id = ?',
      [row.id]
    );
    return { allowed: true };
  }

  if (row.hit_count >= IP_RATE_LIMIT_MAX) {
    const lockedUntil = new Date(now.getTime() + windowMinutes * 60 * 1000);
    await pool.query('UPDATE rate_limit_ip SET locked_until = ? WHERE id = ?', [
      lockedUntil,
      row.id,
    ]);
    return {
      allowed: false,
      message: `Terlalu banyak permintaan. Coba lagi dalam ${windowMinutes} menit.`,
    };
  }

  await pool.query('UPDATE rate_limit_ip SET hit_count = hit_count + 1 WHERE id = ?', [
    row.id,
  ]);
  return { allowed: true };
}

module.exports = { checkIpRateLimit };
