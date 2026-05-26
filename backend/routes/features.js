const pool = require('../db');
const { ensureSchema } = require('../lib/schema');
const {
    ensureDefaultWallet,
    balanceDelta,
    applyWalletDelta,
    insertTransaction,
    reverseTransactionWallet,
} = require('../lib/wallets');
const { runDailyCron } = require('../lib/cronJobs');
const { ensureDefaultCategories } = require('../lib/categories');

function registerFeatureRoutes(app, auth) {
    const cronSecret = process.env.CRON_SECRET;

    const cronAuth = (req, res, next) => {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.secret;
        if (!cronSecret || token !== cronSecret) {
            return res.status(401).json({ error: 'Unauthorized cron' });
        }
        next();
    };

    // --- WALLETS ---
    app.get('/api/wallets', auth, async (req, res) => {
        try {
            await ensureSchema();
            await ensureDefaultWallet(null, req.user.id);
            const [rows] = await pool.query(
                'SELECT id, name, type, balance, is_default, created_at FROM wallets WHERE user_id = ? ORDER BY is_default DESC, name ASC',
                [req.user.id]
            );
            res.set('Cache-Control', 'private, max-age=20');
            res.send(rows);
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    app.post('/api/wallets', auth, async (req, res) => {
        try {
            const { name, type } = req.body;
            if (!name?.trim()) return res.status(400).send({ error: 'Nama dompet wajib diisi.' });
            const [result] = await pool.query(
                'INSERT INTO wallets (user_id, name, type, balance, is_default) VALUES (?, ?, ?, 0, 0)',
                [req.user.id, name.trim(), type || 'cash']
            );
            res.status(201).send({ id: result.insertId, name: name.trim(), type: type || 'cash', balance: 0, is_default: 0 });
        } catch (e) {
            res.status(400).send({ error: e.message });
        }
    });

    app.put('/api/wallets/:id', auth, async (req, res) => {
        try {
            const { name, type } = req.body;
            const [result] = await pool.query(
                'UPDATE wallets SET name = ?, type = ? WHERE id = ? AND user_id = ?',
                [name, type || 'cash', req.params.id, req.user.id]
            );
            if (result.affectedRows === 0) return res.status(404).send({ error: 'Dompet tidak ditemukan.' });
            res.send({ id: Number(req.params.id), name, type });
        } catch (e) {
            res.status(400).send({ error: e.message });
        }
    });

    app.delete('/api/wallets/:id', auth, async (req, res) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [w] = await conn.query(
                'SELECT id, is_default FROM wallets WHERE id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );
            if (w.length === 0) {
                await conn.rollback();
                return res.status(404).send({ error: 'Dompet tidak ditemukan.' });
            }
            const [txCount] = await conn.query(
                'SELECT COUNT(*) AS c FROM transactions WHERE wallet_id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );
            if (Number(txCount[0].c) > 0) {
                await conn.rollback();
                return res.status(400).send({ error: 'Dompet masih memiliki transaksi. Pindahkan atau hapus transaksi terlebih dahulu.' });
            }
            await conn.query('DELETE FROM wallets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            if (w[0].is_default) {
                const [other] = await conn.query(
                    'SELECT id FROM wallets WHERE user_id = ? LIMIT 1',
                    [req.user.id]
                );
                if (other.length > 0) {
                    await conn.query('UPDATE wallets SET is_default = 1 WHERE id = ?', [other[0].id]);
                }
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

    app.post('/api/wallets/transfer', auth, async (req, res) => {
        const { from_wallet_id, to_wallet_id, amount, date, note } = req.body;
        const amt = parseFloat(amount);
        if (!from_wallet_id || !to_wallet_id || from_wallet_id === to_wallet_id) {
            return res.status(400).send({ error: 'Dompet asal dan tujuan tidak valid.' });
        }
        if (!amt || amt <= 0) return res.status(400).send({ error: 'Nominal transfer tidak valid.' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [fromRows] = await conn.query(
                'SELECT id, balance FROM wallets WHERE id = ? AND user_id = ? FOR UPDATE',
                [from_wallet_id, req.user.id]
            );
            const [toRows] = await conn.query(
                'SELECT id FROM wallets WHERE id = ? AND user_id = ? FOR UPDATE',
                [to_wallet_id, req.user.id]
            );
            if (fromRows.length === 0 || toRows.length === 0) {
                await conn.rollback();
                return res.status(404).send({ error: 'Dompet tidak ditemukan.' });
            }
            if (parseFloat(fromRows[0].balance) < amt) {
                await conn.rollback();
                return res.status(400).send({ error: 'Saldo dompet asal tidak mencukupi.' });
            }
            await conn.query(
                'UPDATE wallets SET balance = balance - ? WHERE id = ? AND user_id = ?',
                [amt, from_wallet_id, req.user.id]
            );
            await conn.query(
                'UPDATE wallets SET balance = balance + ? WHERE id = ? AND user_id = ?',
                [amt, to_wallet_id, req.user.id]
            );
            const [xfer] = await conn.query(
                'INSERT INTO wallet_transfers (user_id, from_wallet_id, to_wallet_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user.id, from_wallet_id, to_wallet_id, amt, date || new Date().toISOString().slice(0, 10), note || '']
            );
            await conn.commit();
            res.status(201).send({ id: xfer.insertId, from_wallet_id, to_wallet_id, amount: amt, date, note });
        } catch (e) {
            await conn.rollback();
            res.status(500).send({ error: e.message });
        } finally {
            conn.release();
        }
    });

    app.get('/api/wallets/transfers', auth, async (req, res) => {
        try {
            const [rows] = await pool.query(
                `SELECT t.id, t.amount, t.date, t.note, t.created_at,
                        fw.name AS from_name, tw.name AS to_name
                 FROM wallet_transfers t
                 JOIN wallets fw ON fw.id = t.from_wallet_id
                 JOIN wallets tw ON tw.id = t.to_wallet_id
                 WHERE t.user_id = ?
                 ORDER BY t.date DESC, t.id DESC
                 LIMIT 50`,
                [req.user.id]
            );
            res.send(rows);
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    // --- ALERT PREFERENCES ---
    app.get('/api/alerts/settings', auth, async (req, res) => {
        try {
            const [rows] = await pool.query(
                'SELECT budget_on, subscription_on, savings_on FROM user_alert_prefs WHERE user_id = ?',
                [req.user.id]
            );
            if (rows.length === 0) {
                return res.send({ budget_on: true, subscription_on: true, savings_on: true });
            }
            const r = rows[0];
            res.send({
                budget_on: !!r.budget_on,
                subscription_on: !!r.subscription_on,
                savings_on: !!r.savings_on,
            });
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    app.put('/api/alerts/settings', auth, async (req, res) => {
        try {
            const { budget_on, subscription_on, savings_on } = req.body;
            await pool.query(
                `INSERT INTO user_alert_prefs (user_id, budget_on, subscription_on, savings_on)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE budget_on = VALUES(budget_on),
                 subscription_on = VALUES(subscription_on), savings_on = VALUES(savings_on)`,
                [
                    req.user.id,
                    budget_on ? 1 : 0,
                    subscription_on ? 1 : 0,
                    savings_on ? 1 : 0,
                ]
            );
            res.send({ budget_on: !!budget_on, subscription_on: !!subscription_on, savings_on: !!savings_on });
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    // --- CUSTOM CATEGORIES ---
    app.get('/api/categories', auth, async (req, res) => {
        try {
            await ensureSchema();
            await ensureDefaultCategories(null, req.user.id);
            const [rows] = await pool.query(
                'SELECT id, name, color FROM user_categories WHERE user_id = ? ORDER BY name ASC',
                [req.user.id]
            );
            res.set('Cache-Control', 'private, max-age=60');
            res.send(rows);
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    app.post('/api/categories', auth, async (req, res) => {
        try {
            const { name, color } = req.body;
            if (!name?.trim()) return res.status(400).send({ error: 'Nama kategori wajib diisi.' });
            const [result] = await pool.query(
                'INSERT INTO user_categories (user_id, name, color) VALUES (?, ?, ?)',
                [req.user.id, name.trim(), color || '#6366f1']
            );
            res.status(201).send({ id: result.insertId, name: name.trim(), color: color || '#6366f1' });
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
                return res.status(400).send({ error: 'Kategori sudah ada.' });
            }
            res.status(400).send({ error: e.message });
        }
    });

    app.put('/api/categories/:id', auth, async (req, res) => {
        const conn = await pool.getConnection();
        try {
            const { name, color } = req.body;
            if (!name?.trim()) return res.status(400).send({ error: 'Nama kategori wajib diisi.' });
            const [old] = await conn.query(
                'SELECT name FROM user_categories WHERE id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );
            if (old.length === 0) return res.status(404).send({ error: 'Kategori tidak ditemukan.' });

            await conn.beginTransaction();
            await conn.query(
                'UPDATE user_categories SET name = ?, color = ? WHERE id = ? AND user_id = ?',
                [name.trim(), color || '#6366f1', req.params.id, req.user.id]
            );
            if (old[0].name !== name.trim()) {
                await conn.query(
                    'UPDATE transactions SET category = ? WHERE user_id = ? AND category = ?',
                    [name.trim(), req.user.id, old[0].name]
                );
                await conn.query(
                    'UPDATE budgets SET category = ? WHERE user_id = ? AND category = ?',
                    [name.trim(), req.user.id, old[0].name]
                );
            }
            await conn.commit();
            res.send({ id: Number(req.params.id), name: name.trim(), color: color || '#6366f1' });
        } catch (e) {
            await conn.rollback();
            if (e.code === 'ER_DUP_ENTRY') {
                return res.status(400).send({ error: 'Nama kategori sudah dipakai.' });
            }
            res.status(400).send({ error: e.message });
        } finally {
            conn.release();
        }
    });

    app.delete('/api/categories/:id', auth, async (req, res) => {
        try {
            const [cat] = await pool.query(
                'SELECT name FROM user_categories WHERE id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );
            if (cat.length === 0) return res.status(404).send({ error: 'Kategori tidak ditemukan.' });

            const [[tx]] = await pool.query(
                'SELECT COUNT(*) AS c FROM transactions WHERE user_id = ? AND category = ?',
                [req.user.id, cat[0].name]
            );
            const [[bg]] = await pool.query(
                'SELECT COUNT(*) AS c FROM budgets WHERE user_id = ? AND category = ?',
                [req.user.id, cat[0].name]
            );
            if (Number(tx.c) + Number(bg.c) > 0) {
                return res.status(400).send({
                    error: 'Kategori masih dipakai transaksi/anggaran. Ubah nama atau hapus data terkait dulu.',
                });
            }
            await pool.query('DELETE FROM user_categories WHERE id = ? AND user_id = ?', [
                req.params.id,
                req.user.id,
            ]);
            res.send({ message: 'Deleted' });
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    // --- DEBTS (utang & piutang) ---
    app.get('/api/debts', auth, async (req, res) => {
        try {
            const [rows] = await pool.query(
                `SELECT id, direction, counterparty, amount, paid_amount,
                        (amount - paid_amount) AS remaining,
                        (paid_amount >= amount) AS is_paid,
                        due_date, note, created_at
                 FROM debts WHERE user_id = ?
                 ORDER BY (paid_amount >= amount) ASC,
                          due_date IS NULL, due_date ASC, id DESC`,
                [req.user.id]
            );
            res.set('Cache-Control', 'private, max-age=20');
            res.send(rows);
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    app.post('/api/debts', auth, async (req, res) => {
        try {
            const { direction, counterparty, amount, due_date, note } = req.body;
            if (!counterparty?.trim()) return res.status(400).send({ error: 'Nama wajib diisi.' });
            const amt = parseFloat(amount);
            if (!amt || amt <= 0) return res.status(400).send({ error: 'Nominal tidak valid.' });
            const [result] = await pool.query(
                `INSERT INTO debts (user_id, direction, counterparty, amount, due_date, note)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.user.id, direction, counterparty.trim(), amt, due_date || null, note || '']
            );
            res.status(201).send({
                id: result.insertId,
                direction,
                counterparty: counterparty.trim(),
                amount: amt,
                paid_amount: 0,
                remaining: amt,
                is_paid: 0,
                due_date: due_date || null,
                note: note || '',
            });
        } catch (e) {
            res.status(400).send({ error: e.message });
        }
    });

    app.put('/api/debts/:id', auth, async (req, res) => {
        try {
            const { counterparty, amount, due_date, note } = req.body;
            const amt = parseFloat(amount);
            const [result] = await pool.query(
                `UPDATE debts SET counterparty = ?, amount = ?, due_date = ?, note = ?
                 WHERE id = ? AND user_id = ? AND paid_amount = 0`,
                [counterparty?.trim(), amt, due_date || null, note || '', req.params.id, req.user.id]
            );
            if (result.affectedRows === 0) {
                return res.status(400).send({
                    error: 'Tidak dapat mengubah: utang tidak ditemukan, sudah ada cicilan, atau sudah lunas.',
                });
            }
            res.send({ id: Number(req.params.id) });
        } catch (e) {
            res.status(400).send({ error: e.message });
        }
    });

    app.delete('/api/debts/:id', auth, async (req, res) => {
        try {
            await pool.query('DELETE FROM debts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            res.send({ message: 'Deleted' });
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    app.get('/api/debts/:id/payments', auth, async (req, res) => {
        try {
            const [debt] = await pool.query(
                'SELECT id FROM debts WHERE id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );
            if (debt.length === 0) return res.status(404).send({ error: 'Utang tidak ditemukan.' });
            const [rows] = await pool.query(
                'SELECT id, amount, paid_at, note FROM debt_payments WHERE debt_id = ? ORDER BY paid_at DESC, id DESC LIMIT 30',
                [req.params.id]
            );
            res.send(rows);
        } catch (e) {
            res.status(500).send({ error: e.message });
        }
    });

    app.post('/api/debts/:id/pay', auth, async (req, res) => {
        const { amount, paid_at, note } = req.body;
        const payAmt = parseFloat(amount);
        if (!payAmt || payAmt <= 0) return res.status(400).send({ error: 'Nominal cicilan tidak valid.' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query(
                'SELECT id, amount, paid_amount FROM debts WHERE id = ? AND user_id = ? FOR UPDATE',
                [req.params.id, req.user.id]
            );
            if (rows.length === 0) {
                await conn.rollback();
                return res.status(404).send({ error: 'Utang tidak ditemukan.' });
            }
            const debt = rows[0];
            const remaining = parseFloat(debt.amount) - parseFloat(debt.paid_amount);
            if (remaining <= 0) {
                await conn.rollback();
                return res.status(400).send({ error: 'Utang sudah lunas.' });
            }
            const applied = Math.min(payAmt, remaining);
            await conn.query(
                'INSERT INTO debt_payments (debt_id, amount, paid_at, note) VALUES (?, ?, ?, ?)',
                [req.params.id, applied, paid_at || new Date().toISOString().slice(0, 10), note || '']
            );
            await conn.query(
                'UPDATE debts SET paid_amount = paid_amount + ? WHERE id = ?',
                [applied, req.params.id]
            );
            await conn.commit();
            res.status(201).send({
                applied,
                remaining: remaining - applied,
                is_paid: remaining - applied <= 0,
            });
        } catch (e) {
            await conn.rollback();
            res.status(500).send({ error: e.message });
        } finally {
            conn.release();
        }
    });

    // --- CRON (1 endpoint = alert email harian, hemat invokasi Vercel) ---
    app.get('/api/cron/daily', cronAuth, async (req, res) => {
        try {
            await ensureSchema();
            const result = await runDailyCron();
            res.send(result);
        } catch (e) {
            console.error('cron daily', e);
            res.status(500).send({ error: e.message });
        }
    });
}

module.exports = { registerFeatureRoutes, ensureSchema };
