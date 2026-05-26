/** Update wallet balance atomically; delta positive = income, negative = expense */
async function applyWalletDelta(conn, userId, walletId, delta) {
    if (!walletId) return;
    const [r] = await conn.query(
        'UPDATE wallets SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [delta, walletId, userId]
    );
    if (r.affectedRows === 0) throw new Error('Dompet tidak ditemukan.');
}

function txDelta(type, amount) {
    const n = parseFloat(amount);
    return type === 'income' ? n : -n;
}

async function ensureDefaultWallet(conn, userId) {
    const [rows] = await conn.query(
        'SELECT id FROM wallets WHERE user_id = ? LIMIT 1',
        [userId]
    );
    if (rows.length > 0) return rows[0].id;
    const [ins] = await conn.query(
        'INSERT INTO wallets (user_id, name, type, balance, is_default) VALUES (?, ?, ?, 0, 1)',
        [userId, 'Dompet Utama', 'cash']
    );
    return ins.insertId;
}

module.exports = { applyWalletDelta, txDelta, ensureDefaultWallet };
