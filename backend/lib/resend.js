const nodemailer = require('nodemailer');
const fs = require('fs');

// Function to write logs to file
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync('email-debug.log', logMessage);
}

// SMTP Configuration from .env
const SMTP_SERVER = process.env.SMTP_SERVER;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_LOGIN = process.env.SMTP_LOGIN;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const FROM_EMAIL = process.env.SMTP_SENDER || process.env.SMTP_LOGIN; // Use verified sender address if set

async function sendOtpEmail(to, otpCode, { subject, title, description }) {
  writeLog('sendOtpEmail called with environment: ' + JSON.stringify({
    SMTP_SERVER,
    SMTP_PORT,
    SMTP_LOGIN,
    SMTP_PASSWORD: SMTP_PASSWORD ? 'SET' : 'NOT_SET',
    FROM_EMAIL,
    to
  }));

  if (!SMTP_SERVER || !SMTP_PORT || !SMTP_LOGIN || !SMTP_PASSWORD) {
    writeLog('ERROR: SMTP configuration tidak lengkap. Set SMTP_SERVER, SMTP_PORT, SMTP_LOGIN, dan SMTP_PASSWORD di file .env');
    throw new Error('Konfigurasi email belum disiapkan. Hubungi administrator untuk setup SMTP.');
  }

  try {
    writeLog('Creating SMTP transporter...');
    const transporter = nodemailer.createTransport({
      host: SMTP_SERVER,
      port: SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: SMTP_LOGIN,
        pass: SMTP_PASSWORD,
      },
    });

    writeLog('Sending email to: ' + to + ' from: ' + FROM_EMAIL);
    const mailOptions = {
      from: FROM_EMAIL,
      to: to,
      subject: subject,
      html: `
          <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #6366f1;">${title}</h2>
            <p>${description}</p>
            <p style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #111;">${otpCode}</p>
            <p style="color: #64748b; font-size: 14px;">Kode berlaku <strong>5 menit</strong>. Jangan bagikan kode ini kepada siapa pun.</p>
            <p style="color: #64748b; font-size: 12px;">— TendouAriisu</p>
          </div>
        `,
    };

    const info = await transporter.sendMail(mailOptions);
    writeLog('Email sent successfully: ' + info.messageId);
    return info;
  } catch (error) {
    writeLog('Error sending OTP email: ' + error.message);
    writeLog('Full error details: ' + JSON.stringify(error));
    throw error;
  }
}

async function sendPasswordResetOtpEmail(to, otpCode) {
  return sendOtpEmail(to, otpCode, {
    subject: 'Kode OTP Reset Kata Sandi — TendouAriisu',
    title: 'Reset Kata Sandi',
    description: 'Kode OTP Anda untuk reset kata sandi:',
  });
}

async function sendRegistrationOtpEmail(to, otpCode) {
  return sendOtpEmail(to, otpCode, {
    subject: 'Kode OTP Pendaftaran Akun — TendouAriisu',
    title: 'Verifikasi Pendaftaran',
    description: 'Kode OTP Anda untuk menyelesaikan pendaftaran akun:',
  });
}

module.exports = { sendOtpEmail, sendPasswordResetOtpEmail, sendRegistrationOtpEmail };
