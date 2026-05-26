const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { sendRegistrationOtpEmail } = require('./resend');
const { checkIpRateLimit } = require('./rateLimit');
const { isAdminEmail, normalizeEmail } = require('./adminPolicy');
const {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_COOLDOWN_MINUTES,
} = require('../config/constants');

// Function to write logs to file
function writeLog(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function generateOtpCode() {
  return String(crypto.randomInt(10000, 100000));
}

async function getActiveRegisterOtpRow(email) {
  const [rows] = await pool.query(
    `SELECT * FROM registration_otps
     WHERE email = ? AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function requestRegisterOtp(username, email, password, ip) {
  const normalized = normalizeEmail(email);
  const trimmedUsername = String(username || '').trim();

  writeLog('requestRegisterOtp called with: ' + JSON.stringify({ username, email: normalized, ip }));

  const rate = await checkIpRateLimit(ip, 'register-otp');
  if (!rate.allowed) {
    return { status: 429, error: rate.message };
  }

  if (!trimmedUsername) {
    return { status: 400, error: 'Nama pengguna wajib diisi.' };
  }

  // Validasi format email dasar - support Gmail, Outlook, Yahoo, dll
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return { status: 400, error: 'Format email tidak valid. Gunakan email yang valid (contoh: nama@gmail.com).' };
  }

  if (isAdminEmail(normalized)) {
    return { status: 400, error: 'Email ini tidak dapat digunakan untuk pendaftaran.' };
  }

  if (!password || String(password).length < 6) {
    return { status: 400, error: 'Kata sandi minimal 6 karakter.' };
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [
    normalized,
  ]);
  if (existing.length > 0) {
    return { status: 400, error: 'Email sudah terdaftar. Silakan masuk atau reset kata sandi.' };
  }

  const otpRow = await getActiveRegisterOtpRow(normalized);
  if (otpRow?.locked_until && new Date(otpRow.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(otpRow.locked_until) - new Date()) / 60000
    );
    return {
      status: 429,
      error: `Terlalu banyak percobaan OTP. Coba lagi dalam ${minutesLeft} menit.`,
    };
  }

  await pool.query('DELETE FROM registration_otps WHERE email = ?', [normalized]);

  const otpCode = generateOtpCode();
  const otpHash = await bcrypt.hash(otpCode, 10);
  const passwordHash = await bcrypt.hash(password, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO registration_otps (email, username, password_hash, otp_hash, ip_address, attempts, expires_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [normalized, trimmedUsername, passwordHash, otpHash, ip, expiresAt]
  );

  try {
    writeLog('About to send registration OTP email to: ' + normalized);
    await sendRegistrationOtpEmail(normalized, otpCode);
    writeLog('Registration OTP email sent successfully to: ' + normalized);
  } catch (e) {
    writeLog('Error sending registration OTP email: ' + e.message);
    await pool.query('DELETE FROM registration_otps WHERE email = ?', [normalized]);
    writeLog('Error details: ' + JSON.stringify(e));
    return { status: 500, error: 'Gagal mengirim email OTP. Coba lagi nanti.' };
  }

  return {
    status: 200,
    message:
      'Kode OTP telah dikirim ke email Anda. Periksa kotak masuk (dan spam). Kode berlaku 5 menit.',
  };
}

async function verifyRegisterWithOtp(email, otp, ip) {
  const normalized = normalizeEmail(email);

  const rate = await checkIpRateLimit(ip, 'register-verify');
  if (!rate.allowed) {
    return { status: 429, error: rate.message };
  }

  const otpRow = await getActiveRegisterOtpRow(normalized);

  if (!otpRow) {
    return {
      status: 400,
      error: 'Kode OTP tidak valid atau sudah kedaluwarsa. Minta kode baru.',
    };
  }

  if (otpRow.locked_until && new Date(otpRow.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(otpRow.locked_until) - new Date()) / 60000
    );
    return {
      status: 429,
      error: `Terlalu banyak percobaan. Coba lagi dalam ${minutesLeft} menit.`,
    };
  }

  const otpString = String(otp || '').trim();
  if (!/^\d{5}$/.test(otpString)) {
    return { status: 400, error: 'Kode OTP harus 5 digit angka.' };
  }

  const isValid = await bcrypt.compare(otpString, otpRow.otp_hash);

  if (!isValid) {
    const newAttempts = otpRow.attempts + 1;
    if (newAttempts >= OTP_MAX_ATTEMPTS) {
      const lockedUntil = new Date(
        Date.now() + OTP_COOLDOWN_MINUTES * 60 * 1000
      );
      await pool.query(
        'UPDATE registration_otps SET attempts = ?, locked_until = ? WHERE id = ?',
        [newAttempts, lockedUntil, otpRow.id]
      );
      return {
        status: 429,
        error: `Kode OTP salah. Batas percobaan habis. Coba lagi dalam ${OTP_COOLDOWN_MINUTES} menit.`,
      };
    }

    await pool.query('UPDATE registration_otps SET attempts = ? WHERE id = ?', [
      newAttempts,
      otpRow.id,
    ]);

    const remaining = OTP_MAX_ATTEMPTS - newAttempts;
    return {
      status: 400,
      error: `Kode OTP tidak valid. Sisa percobaan: ${remaining}.`,
    };
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [
    normalized,
  ]);
  if (existing.length > 0) {
    await pool.query('DELETE FROM registration_otps WHERE email = ?', [normalized]);
    return { status: 400, error: 'Email sudah terdaftar. Silakan masuk.' };
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [otpRow.username, normalized, otpRow.password_hash, 'user']
    );
    await pool.query('DELETE FROM registration_otps WHERE email = ?', [normalized]);

    return {
      status: 201,
      message: 'Pendaftaran berhasil! Silakan masuk dengan akun Anda.',
      user: {
        id: result.insertId,
        username: otpRow.username,
        email: normalized,
        role: 'user',
      },
    };
  } catch (e) {
    console.error(e);
    return { status: 400, error: 'Gagal menyimpan akun. Coba lagi.' };
  }
}

module.exports = { requestRegisterOtp, verifyRegisterWithOtp };
