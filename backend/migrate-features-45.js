/**
 * Migrasi fitur 4–5: utang/piutang & kategori kustom.
 * Jalankan: node migrate-features-45.js
 */
const { ensureSchema } = require('./lib/schema');
const pool = require('./db');
const { ensureDefaultCategories } = require('./lib/categories');

async function main() {
    try {
        await ensureSchema();
        const [users] = await pool.query('SELECT id FROM users');
        for (const u of users) {
            await ensureDefaultCategories(null, u.id);
        }
        console.log('Migrasi fitur 4–5 selesai.');
        process.exit(0);
    } catch (e) {
        console.error('Migrasi gagal:', e);
        process.exit(1);
    }
}

main();
