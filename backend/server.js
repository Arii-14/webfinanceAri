const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
console.log('Environment variables loaded:');
console.log('SMTP_SERVER:', process.env.SMTP_SERVER);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_LOGIN:', process.env.SMTP_LOGIN);

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const getClientIp = require('./lib/getClientIp');
const { requestPasswordOtp, resetPasswordWithOtp } = require('./lib/passwordReset');
const { requestRegisterOtp, verifyRegisterWithOtp } = require('./lib/registration');
const {
    ADMIN_EMAIL,
    isAdminEmail,
    resolveUserRole,
    ensureSingleAdmin,
    normalizeEmail,
} = require('./lib/adminPolicy');
const { registerFeatureRoutes, ensureSchema } = require('./routes/features');
const {
    insertTransaction,
    reverseTransactionWallet,
    balanceDelta,
    applyWalletDelta,
} = require('./lib/wallets');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'secret-finance-key';

// ============================================================
// RATE LIMITER — Anti-Spam (in-memory, Vercel-compatible)
// Batas: 40 request per 60 detik per IP. Cooldown: 2 menit.
// ============================================================
const rateLimitStore = new Map(); // key: ip, value: { count, firstRequest, blockedUntil }
const RATE_LIMIT_MAX = 40;         // maks request
const RATE_LIMIT_WINDOW_MS = 60 * 1000;   // 60 detik window
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000; // 2 menit cooldown

function rateLimiter(req, res, next) {
    // Skip rate limit untuk static assets
    if (!req.path.startsWith('/api/')) return next();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'unknown';
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    // Sedang dalam masa cooldown?
    if (record?.blockedUntil && now < record.blockedUntil) {
        const sisaDetik = Math.ceil((record.blockedUntil - now) / 1000);
        const menit = Math.floor(sisaDetik / 60);
        const detik = sisaDetik % 60;
        return res.status(429).json({
            error: `Terlalu banyak permintaan. Harap tunggu ${menit > 0 ? menit + ' menit ' : ''}${detik} detik sebelum mencoba lagi.`,
            retryAfter: record.blockedUntil
        });
    }

    // Reset window jika sudah expired
    if (!record || now - record.firstRequest > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.set(ip, { count: 1, firstRequest: now, blockedUntil: null });
        return next();
    }

    record.count++;
    if (record.count > RATE_LIMIT_MAX) {
        record.blockedUntil = now + RATE_LIMIT_COOLDOWN_MS;
        rateLimitStore.set(ip, record);
        return res.status(429).json({
            error: 'Terlalu banyak permintaan. Harap tunggu 2 menit sebelum mencoba lagi.',
            retryAfter: record.blockedUntil
        });
    }

    rateLimitStore.set(ip, record);
    next();
}

app.use(rateLimiter);

// Bersihkan entri lama dari memori setiap 5 menit (cegah memory leak)
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
        const expired = record.blockedUntil
            ? now > record.blockedUntil + 60000
            : now - record.firstRequest > RATE_LIMIT_WINDOW_MS * 2;
        if (expired) rateLimitStore.delete(ip);
    }
}, 5 * 60 * 1000);

// JWT Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) throw new Error();
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).send({ error: 'Please authenticate.' });
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin' || !isAdminEmail(decoded.email)) {
            return res.status(403).send({ error: 'Admin access required.' });
        }
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

ensureSingleAdmin().catch((e) => console.error('ensureSingleAdmin:', e.message));
ensureSchema().catch((e) => console.error('ensureSchema:', e.message));

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (rows.length === 0) return res.status(400).send({ error: 'Invalid credentials' });

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).send({ error: 'Invalid credentials' });

        const role = resolveUserRole(user.email, user.role);
        if (role !== user.role) {
            await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, user.id]);
        }
        const token = jwt.sign({ id: user.id, role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.send({ token, user: { id: user.id, username: user.username, email: user.email, role, profile_image: user.profile_image } });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/auth/register/request-otp', async (req, res) => {
    console.log('REGISTER OTP REQUEST:', req.body);
    try {
        const { username, email, password } = req.body;
        const ip = getClientIp(req);
        const result = await requestRegisterOtp(username, email, password, ip);
        if (result.error) {
            return res.status(result.status).send({ error: result.error });
        }
        res.send({ message: result.message });
    } catch (e) {
        console.error(e);
        res.status(500).send({ error: 'Terjadi kesalahan. Coba lagi nanti.' });
    }
});

app.post('/api/auth/register/verify', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const ip = getClientIp(req);
        const result = await verifyRegisterWithOtp(email, otp, ip);
        if (result.error) {
            return res.status(result.status).send({ error: result.error });
        }
        res.status(result.status).send({ message: result.message, user: result.user });
    } catch (e) {
        console.error(e);
        res.status(500).send({ error: 'Terjadi kesalahan. Coba lagi nanti.' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const ip = getClientIp(req);
        const result = await requestPasswordOtp(email, ip);
        if (result.error) {
            return res.status(result.status).send({ error: result.error });
        }
        res.send({ message: result.message });
    } catch (e) {
        console.error(e);
        res.status(500).send({ error: 'Terjadi kesalahan. Coba lagi nanti.' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const ip = getClientIp(req);
        const result = await resetPasswordWithOtp(email, otp, newPassword, ip);
        if (result.error) {
            return res.status(result.status).send({ error: result.error });
        }
        res.send({ message: result.message });
    } catch (e) {
        console.error(e);
        res.status(500).send({ error: 'Terjadi kesalahan. Coba lagi nanti.' });
    }
});

app.get('/api/auth/me', auth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, email, role, profile_image, created_at FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).send();
        const row = rows[0];
        const role = resolveUserRole(row.email, row.role);
        res.send({ ...row, role });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- TRANSACTIONS ROUTES ---
app.get('/api/transactions', auth, async (req, res) => {
    try {
        // Selalu query berdasarkan user_id — tidak ada full dump lintas user
        const query = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC';
        const params = [req.user.id];
        const [rows] = await pool.query(query, params);
        res.set('Cache-Control', 'private, max-age=15');
        res.send(rows);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/transactions', auth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { type, amount, category, date, note, wallet_id } = req.body;
        await conn.beginTransaction();
        const id = await insertTransaction(conn, req.user.id, { type, amount, category, date, note, wallet_id });
        await conn.commit();
        res.status(201).send({ id, user_id: req.user.id, type, amount, category, date, note, wallet_id: wallet_id || null });
    } catch (e) {
        await conn.rollback();
        res.status(400).send({ error: e.message });
    } finally {
        conn.release();
    }
});

app.put('/api/transactions/:id', auth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { type, amount, category, date, note, wallet_id } = req.body;
        const isAdmin = req.user.role === 'admin';
        const [oldRows] = await conn.query(
            isAdmin
                ? 'SELECT * FROM transactions WHERE id = ?'
                : 'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
            isAdmin ? [req.params.id] : [req.params.id, req.user.id]
        );
        if (oldRows.length === 0) {
            await conn.rollback();
            return res.status(404).send({ error: 'Transaksi tidak ditemukan.' });
        }
        const oldTx = oldRows[0];
        const ownerId = oldTx.user_id;

        await conn.beginTransaction();
        await reverseTransactionWallet(conn, ownerId, oldTx);

        if (isAdmin) {
            await conn.query(
                'UPDATE transactions SET type = ?, amount = ?, category = ?, date = ?, note = ?, wallet_id = ? WHERE id = ?',
                [type, amount, category, date, note || '', wallet_id || null, req.params.id]
            );
        } else {
            await conn.query(
                'UPDATE transactions SET type = ?, amount = ?, category = ?, date = ?, note = ?, wallet_id = ? WHERE id = ? AND user_id = ?',
                [type, amount, category, date, note || '', wallet_id || null, req.params.id, req.user.id]
            );
        }
        if (wallet_id) {
            await applyWalletDelta(conn, ownerId, wallet_id, balanceDelta(type, amount));
        }
        await conn.commit();
        res.send({ id: Number(req.params.id), type, amount, category, date, note: note || '', wallet_id: wallet_id || null });
    } catch (e) {
        await conn.rollback();
        res.status(400).send({ error: e.message });
    } finally {
        conn.release();
    }
});

app.delete('/api/transactions/:id', auth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const isAdmin = req.user.role === 'admin';
        const [oldRows] = await conn.query(
            isAdmin
                ? 'SELECT * FROM transactions WHERE id = ?'
                : 'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
            isAdmin ? [req.params.id] : [req.params.id, req.user.id]
        );
        if (oldRows.length === 0) {
            await conn.rollback();
            return res.status(404).send({ error: 'Transaksi tidak ditemukan.' });
        }
        const oldTx = oldRows[0];
        await conn.beginTransaction();
        await reverseTransactionWallet(conn, oldTx.user_id, oldTx);
        if (isAdmin) {
            await conn.query('DELETE FROM transactions WHERE id = ?', [req.params.id]);
        } else {
            await conn.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        }
        await conn.commit();
        res.send({ message: 'Deleted' });
    } catch (e) {
        await conn.rollback();
        res.status(500).send({ error: e.message });
    } finally {
        conn.release();
    }
});

// --- USER & PROFILE ROUTES ---
// Update Profile (Username, Email)
app.put('/api/users/profile', auth, async (req, res) => {
    try {
        const { username, email } = req.body;
        await pool.query('UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, req.user.id]);
        res.send({ message: 'Profile updated' });
    } catch (e) {
        res.status(500).send({ error: 'Failed to update profile' });
    }
});

// Profile image update (base64)
app.post('/api/users/profile-image', auth, async (req, res) => {
    try {
        const { image } = req.body; // base64 string
        if (!image) return res.status(400).send({ error: 'Tidak ada gambar yang dikirim.' });

        // Hitung ukuran asli dari base64 (bytes)
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const sizeInBytes = Buffer.from(base64Data, 'base64').length;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        if (sizeInMB > 8) {
            return res.status(413).send({ error: `Ukuran file gambar terlalu besar (${sizeInMB.toFixed(2)} MB). Maksimal 8 MB.` });
        }

        await pool.query('UPDATE users SET profile_image = ? WHERE id = ?', [image, req.user.id]);
        res.send({ message: 'Profile image updated' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Password Management
app.put('/api/users/password', adminAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
        res.send({ message: 'Admin password updated successfully' });
    } catch (e) {
        res.status(500).send({ error: 'Failed to change password' });
    }
});

// --- SAVINGS GOALS ROUTES ---
app.get('/api/savings', auth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.send(rows);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/savings', auth, async (req, res) => {
    try {
        const { name, target_amount } = req.body;
        const [result] = await pool.query(
            'INSERT INTO savings_goals (user_id, name, target_amount) VALUES (?, ?, ?)',
            [req.user.id, name, target_amount]
        );
        res.status(201).send({ id: result.insertId, user_id: req.user.id, name, target_amount, current_amount: 0 });
    } catch (e) {
        res.status(400).send(e.message);
    }
});

app.put('/api/savings/:id/add', auth, async (req, res) => {
    try {
        const { amount } = req.body;
        await pool.query('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?', [amount, req.params.id, req.user.id]);
        res.send({ message: 'Savings added' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.put('/api/savings/:id', auth, async (req, res) => {
    try {
        const { name, target_amount, current_amount } = req.body;
        const [result] = await pool.query(
            'UPDATE savings_goals SET name = ?, target_amount = ?, current_amount = ? WHERE id = ? AND user_id = ?',
            [name, target_amount, current_amount ?? 0, req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) return res.status(404).send({ error: 'Target tabungan tidak ditemukan.' });
        res.send({ id: Number(req.params.id), name, target_amount, current_amount: current_amount ?? 0 });
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
});

app.delete('/api/savings/:id', auth, async (req, res) => {
    try {
        await pool.query('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.send({ message: 'Deleted' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- BUDGETS ROUTES ---
app.get('/api/budgets', auth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM budgets WHERE user_id = ?', [req.user.id]);
        res.send(rows);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/budgets', auth, async (req, res) => {
    try {
        const { category, limit_amount, month } = req.body;
        const [result] = await pool.query(
            'INSERT INTO budgets (user_id, category, limit_amount, month) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE limit_amount = ?',
            [req.user.id, category, limit_amount, month, limit_amount]
        );
        res.status(201).send({ message: 'Budget set' });
    } catch (e) {
        res.status(400).send(e.message);
    }
});

app.put('/api/budgets/:id', auth, async (req, res) => {
    try {
        const { category, limit_amount, month } = req.body;
        const [result] = await pool.query(
            'UPDATE budgets SET category = ?, limit_amount = ?, month = ? WHERE id = ? AND user_id = ?',
            [category, limit_amount, month, req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) return res.status(404).send({ error: 'Anggaran tidak ditemukan.' });
        res.send({ id: Number(req.params.id), category, limit_amount, month });
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
});

app.delete('/api/budgets/:id', auth, async (req, res) => {
    try {
        await pool.query('DELETE FROM budgets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.send({ message: 'Deleted' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- SUBSCRIPTIONS ROUTES ---
app.get('/api/subscriptions', auth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_billing_date ASC', [req.user.id]);
        res.send(rows);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/subscriptions', auth, async (req, res) => {
    try {
        const { name, amount, billing_cycle, next_billing_date } = req.body;
        const [result] = await pool.query(
            'INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing_date) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, name, amount, billing_cycle, next_billing_date]
        );
        res.status(201).send({ id: result.insertId, user_id: req.user.id, name, amount, billing_cycle, next_billing_date });
    } catch (e) {
        res.status(400).send(e.message);
    }
});

app.put('/api/subscriptions/:id', auth, async (req, res) => {
    try {
        const { name, amount, billing_cycle, next_billing_date } = req.body;
        const [result] = await pool.query(
            'UPDATE subscriptions SET name = ?, amount = ?, billing_cycle = ?, next_billing_date = ? WHERE id = ? AND user_id = ?',
            [name, amount, billing_cycle, next_billing_date, req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) return res.status(404).send({ error: 'Langganan tidak ditemukan.' });
        res.send({ id: Number(req.params.id), name, amount, billing_cycle, next_billing_date });
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
});

app.delete('/api/subscriptions/:id', auth, async (req, res) => {
    try {
        await pool.query('DELETE FROM subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.send({ message: 'Deleted' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- JOURNALS ROUTES ---
app.get('/api/journals', auth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM journals WHERE user_id = ? ORDER BY date DESC, created_at DESC', [req.user.id]);
        res.send(rows);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/journals', auth, async (req, res) => {
    try {
        const { mood, content, date } = req.body;
        const [result] = await pool.query(
            'INSERT INTO journals (user_id, mood, content, date) VALUES (?, ?, ?, ?)',
            [req.user.id, mood, content, date]
        );
        res.status(201).send({ id: result.insertId, user_id: req.user.id, mood, content, date });
    } catch (e) {
        res.status(400).send(e.message);
    }
});

app.put('/api/journals/:id', auth, async (req, res) => {
    try {
        const { mood, content, date } = req.body;
        const [result] = await pool.query(
            'UPDATE journals SET mood = ?, content = ?, date = ? WHERE id = ? AND user_id = ?',
            [mood, content, date, req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) return res.status(404).send({ error: 'Catatan tidak ditemukan.' });
        res.send({ id: Number(req.params.id), mood, content, date });
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
});

app.delete('/api/journals/:id', auth, async (req, res) => {
    try {
        await pool.query('DELETE FROM journals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.send({ message: 'Deleted' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- ACCOUNTS ROUTES (ENCRYPTED) ---
const ENCRYPTION_KEY = crypto.scryptSync(process.env.JWT_SECRET || 'default_secret_key_123', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

app.get('/api/accounts', auth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM user_accounts WHERE user_id = ? ORDER BY type ASC, created_at DESC', [req.user.id]);
        // Decrypt passwords before sending to frontend
        const decryptedRows = rows.map(row => ({
            ...row,
            password: decrypt(row.password)
        }));
        res.send(decryptedRows);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/accounts', auth, async (req, res) => {
    try {
        const { name, type, login_via, password } = req.body;
        const encryptedPassword = encrypt(password);
        const [result] = await pool.query(
            'INSERT INTO user_accounts (user_id, name, type, login_via, password) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, name, type, login_via, encryptedPassword]
        );
        res.status(201).send({ id: result.insertId, user_id: req.user.id, name, type, login_via, password });
    } catch (e) {
        res.status(400).send(e.message);
    }
});

app.put('/api/accounts/:id', auth, async (req, res) => {
    try {
        const { name, type, login_via, password } = req.body;
        let affected;
        if (password) {
            const encryptedPassword = encrypt(password);
            const [result] = await pool.query(
                'UPDATE user_accounts SET name = ?, type = ?, login_via = ?, password = ? WHERE id = ? AND user_id = ?',
                [name, type, login_via, encryptedPassword, req.params.id, req.user.id]
            );
            affected = result.affectedRows;
        } else {
            const [result] = await pool.query(
                'UPDATE user_accounts SET name = ?, type = ?, login_via = ? WHERE id = ? AND user_id = ?',
                [name, type, login_via, req.params.id, req.user.id]
            );
            affected = result.affectedRows;
        }
        if (affected === 0) return res.status(404).send({ error: 'Akun tidak ditemukan.' });
        res.send({ id: Number(req.params.id), name, type, login_via, password: password || undefined });
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
});

app.delete('/api/accounts/:id', auth, async (req, res) => {
    try {
        await pool.query('DELETE FROM user_accounts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.send({ message: 'Deleted' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- USER DATA DELETION ---
app.delete('/api/users/delete-all-data', auth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const userId = req.user.id;

        await conn.query(
            'DELETE dp FROM debt_payments dp INNER JOIN debts d ON d.id = dp.debt_id WHERE d.user_id = ?',
            [userId]
        );
        await conn.query('DELETE FROM debts WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM user_categories WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM wallet_transfers WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM alert_sent_log WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM user_alert_prefs WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM transactions WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM wallets WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM savings_goals WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM budgets WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM journals WHERE user_id = ?', [userId]);
        await conn.query('DELETE FROM user_accounts WHERE user_id = ?', [userId]);

        await conn.commit();
        res.send({ message: 'Semua data berhasil dihapus' });
    } catch (e) {
        await conn.rollback();
        res.status(500).send(e.message);
    } finally {
        conn.release();
    }
});

// --- ADMIN ROUTES ---

// Statistik ringkasan sistem (1 query ringan, tanpa dump data)
app.get('/api/admin/stats', adminAuth, async (req, res) => {
    try {
        const [[stats]] = await pool.query(`
            SELECT
                COUNT(*) AS total_transactions,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
                COUNT(DISTINCT user_id) AS active_users
            FROM transactions
        `);
        const [[userCount]] = await pool.query('SELECT COUNT(*) AS total FROM users');
        res.set('Cache-Control', 'private, max-age=60');
        res.json({
            total_transactions: Number(stats.total_transactions) || 0,
            total_income: Number(stats.total_income) || 0,
            total_expense: Number(stats.total_expense) || 0,
            active_users: Number(stats.active_users) || 0,
            total_users: Number(userCount.total) || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Daftar user — pagination server-side, TANPA profile_image (hemat bandwidth)
app.get('/api/users', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;

        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
        const [rows] = await pool.query(
            'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.set('Cache-Control', 'private, max-age=30');
        res.json({ users: rows, total, page, limit });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users', adminAuth, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (isAdminEmail(email)) {
            return res.status(400).send({ error: 'Email admin sudah ditetapkan. Hanya satu admin yang diizinkan.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, 'user']
        );
        res.status(201).send({ id: result.insertId, role: 'user' });
    } catch (e) {
        res.status(400).send({ error: 'Email already exists or invalid.' });
    }
});

app.delete('/api/users/:id', adminAuth, async (req, res) => {
    try {
        const [target] = await pool.query('SELECT email, role FROM users WHERE id = ?', [req.params.id]);
        if (target.length === 0) return res.status(404).send({ error: 'Pengguna tidak ditemukan.' });
        if (isAdminEmail(target[0].email)) {
            return res.status(403).send({ error: 'Akun admin tidak dapat dihapus.' });
        }
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.send({ message: 'User deleted' });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

registerFeatureRoutes(app, auth);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
module.exports = app;
