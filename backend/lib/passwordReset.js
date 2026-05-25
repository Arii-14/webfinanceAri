const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { sendPasswordResetOtpEmail } = require('./resend');
const { checkIpRateLimit } = require('./rateLimit');
const {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_COOLDOWN_MINUTES,
} = require('../config/constants');

function generateOtpCode() {
  return String(crypto.randomInt(10000, 100000));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function getActiveOtpRow(email) {
  const [rows] = await pool.query(
    `SELECT * FROM password_reset_otps
     WHERE email = ? AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function requestPasswordOtp(email, ip) {
  const normalized = normalizeEmail(email);

  const rate = await checkIpRateLimit(ip, 'forgot-password');
  if (!rate.allowed) {
    return { status: 429, error: rate.message };
  }

  const [users] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [
    normalized,
  ]);

  if (users.length === 0) {
    return {
      status: 400,
      error: 'Email belum terdaftar. Silakan daftar akun terlebih dahulu.',
    };
  }

  const existing = await getActiveOtpRow(normalized);
  if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(existing.locked_until) - new Date()) / 60000
    );
    return {
      status: 429,
      error: `Terlalu banyak percobaan OTP. Coba lagi dalam ${minutesLeft} menit.`,
    };
  }

  await pool.query('DELETE FROM password_reset_otps WHERE email = ?', [normalized]);

  const otpCode = generateOtpCode();
  const otpHash = await bcrypt.hash(otpCode, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_otps (email, otp_hash, ip_address, attempts, expires_at)
     VALUES (?, ?, ?, 0, ?)`,
    [normalized, otpHash, ip, expiresAt]
  );

  try {
    await sendPasswordResetOtpEmail(normalized, otpCode);
  } catch (e) {
    await pool.query('DELETE FROM password_reset_otps WHERE email = ?', [normalized]);
    console.error(e);
    return { status: 500, error: 'Gagal mengirim email OTP. Coba lagi nanti.' };
  }

  return {
    status: 200,
    message:
      'Kode OTP telah dikirim ke email Anda. Periksa kotak masuk (dan spam). Kode berlaku 5 menit.',
  };
}

async function resetPasswordWithOtp(email, otp, newPassword, ip) {
  const normalized = normalizeEmail(email);

  const rate = await checkIpRateLimit(ip, 'reset-password');
  if (!rate.allowed) {
    return { status: 429, error: rate.message };
  }

  if (!newPassword || String(newPassword).length < 6) {
    return { status: 400, error: 'Kata sandi minimal 6 karakter.' };
  }

  const otpRow = await getActiveOtpRow(normalized);

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
        'UPDATE password_reset_otps SET attempts = ?, locked_until = ? WHERE id = ?',
        [newAttempts, lockedUntil, otpRow.id]
      );
      return {
        status: 429,
        error: `Kode OTP salah. Batas percobaan habis. Coba lagi dalam ${OTP_COOLDOWN_MINUTES} menit.`,
      };
    }

    await pool.query('UPDATE password_reset_otps SET attempts = ? WHERE id = ?', [
      newAttempts,
      otpRow.id,
    ]);

    const remaining = OTP_MAX_ATTEMPTS - newAttempts;
    return {
      status: 400,
      error: `Kode OTP tidak valid. Sisa percobaan: ${remaining}.`,
    };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password = ? WHERE LOWER(email) = ?', [
    hashedPassword,
    normalized,
  ]);
  await pool.query('DELETE FROM password_reset_otps WHERE email = ?', [normalized]);

  return {
    status: 200,
    message: 'Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.',
  };
}

module.exports = { requestPasswordOtp, resetPasswordWithOtp, normalizeEmail };
