const pool = require('../db');

async function ensureDefaultWallet(conn, userId) {
    const db = conn || pool;
    const [rows] = await db.query(
        'SELECT id FROM wallets WHERE user_id = ? LIMIT 1',
        [userId]
    );
    if (rows.length > 0) return rows[0].id;
    const [result] = await db.query(
        'INSERT INTO wallets (user_id, name, type, balance, is_default) VALUES (?, ?, ?, 0, 1)',
        [userId, 'Dompet Utama', 'cash']
    );
    return result.insertId;
}

function balanceDelta(type, amount) {
    const n = parseFloat(amount);
    return type === 'income' ? n : -n;
}

async function applyWalletDelta(conn, userId, walletId, delta) {
    if (!walletId) return;
    const [result] = await conn.query(
        'UPDATE wallets SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [delta, walletId, userId]
    );
    if (result.affectedRows === 0) throw new Error('Dompet tidak ditemukan.');
}

async function insertTransaction(conn, userId, payload) {
    const { type, amount, category, date, note, wallet_id } = payload;
    const [result] = await conn.query(
        'INSERT INTO transactions (user_id, wallet_id, type, amount, category, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, wallet_id || null, type, amount, category, date, note || '']
    );
    if (wallet_id) {
        await applyWalletDelta(conn, userId, wallet_id, balanceDelta(type, amount));
    }
    return result.insertId;
}

async function reverseTransactionWallet(conn, userId, tx) {
    if (!tx.wallet_id) return;
    const reverse = tx.type === 'income' ? -parseFloat(tx.amount) : parseFloat(tx.amount);
    await applyWalletDelta(conn, userId, tx.wallet_id, reverse);
}

module.exports = {
    ensureDefaultWallet,
    balanceDelta,
    applyWalletDelta,
    insertTransaction,
    reverseTransactionWallet,
};
