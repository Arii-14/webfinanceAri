const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const SMTP_SERVER = process.env.SMTP_SERVER;
    const SMTP_PORT = process.env.SMTP_PORT;
    const SMTP_LOGIN = process.env.SMTP_LOGIN;
    const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

    if (!SMTP_SERVER || !SMTP_PORT || !SMTP_LOGIN || !SMTP_PASSWORD) {
        throw new Error('SMTP belum dikonfigurasi.');
    }
    transporter = nodemailer.createTransport({
        host: SMTP_SERVER,
        port: Number(SMTP_PORT),
        secure: false,
        auth: { user: SMTP_LOGIN, pass: SMTP_PASSWORD },
    });
    return transporter;
}

async function sendAlertEmail(to, subject, htmlBody) {
    const t = getTransporter();
    const FROM_EMAIL = process.env.SMTP_SENDER || process.env.SMTP_LOGIN;
    await t.sendMail({
        from: FROM_EMAIL,
        to,
        subject,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #6366f1; margin-bottom: 8px;">TendouAriisu — Peringatan Keuangan</h2>
            ${htmlBody}
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Kelola preferensi notifikasi di Pengaturan Profil aplikasi.</p>
          </div>
        `,
    });
}

module.exports = { sendAlertEmail };
