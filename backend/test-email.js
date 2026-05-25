require('dotenv').config({ path: '../.env' });
const nodemailer = require('nodemailer');

// SMTP Configuration from .env
const SMTP_SERVER = process.env.SMTP_SERVER;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_LOGIN = process.env.SMTP_LOGIN;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const FROM_EMAIL = 'tendouariisu@gmail.com';

console.log('SMTP Configuration:');
console.log('SMTP_SERVER:', SMTP_SERVER);
console.log('SMTP_PORT:', SMTP_PORT);
console.log('SMTP_LOGIN:', SMTP_LOGIN);
console.log('SMTP_PASSWORD:', SMTP_PASSWORD ? '***' : 'MISSING');
console.log('FROM_EMAIL:', FROM_EMAIL);
console.log('');

if (!SMTP_SERVER || !SMTP_PORT || !SMTP_LOGIN || !SMTP_PASSWORD) {
  console.error('ERROR: SMTP configuration tidak lengkap!');
  process.exit(1);
}

async function testEmail() {
  try {
    console.log('Membuat koneksi SMTP...');
    const transporter = nodemailer.createTransport({
      host: SMTP_SERVER,
      port: SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: SMTP_LOGIN,
        pass: SMTP_PASSWORD,
      },
    });

    console.log('Verifikasi koneksi...');
    await transporter.verify();
    console.log('✓ Koneksi SMTP berhasil!');

    // Test sending email
    console.log('Mencoba mengirim email test...');
    const mailOptions = {
      from: SMTP_LOGIN, // Use SMTP login as sender
      to: 'tendouariisu@gmail.com', // Test with the requested email
      subject: 'Test Email — TendouAriisu',
      html: `
          <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #6366f1;">Test Email</h2>
            <p>Ini adalah email test untuk verifikasi SMTP configuration.</p>
            <p>Kode test: 12345</p>
          </div>
        `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email berhasil dikirim!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Full error:', error);
  }
}

testEmail();
