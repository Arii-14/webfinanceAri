const pool = require('../db');

const DEFAULT_CATEGORIES = [
    { name: 'Makanan', color: '#6366f1' },
    { name: 'Transportasi', color: '#3b82f6' },
    { name: 'Hiburan', color: '#a855f7' },
    { name: 'Tagihan', color: '#f59e0b' },
    { name: 'Gaji', color: '#10b981' },
    { name: 'Lainnya', color: '#64748b' },
];

async function ensureDefaultCategories(conn, userId) {
    const db = conn || pool;
    const [rows] = await db.query(
        'SELECT id FROM user_categories WHERE user_id = ? LIMIT 1',
        [userId]
    );
    if (rows.length > 0) return;
    for (const c of DEFAULT_CATEGORIES) {
        await db.query(
            'INSERT INTO user_categories (user_id, name, color) VALUES (?, ?, ?)',
            [userId, c.name, c.color]
        );
    }
}

module.exports = { DEFAULT_CATEGORIES, ensureDefaultCategories };
