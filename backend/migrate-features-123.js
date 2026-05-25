/**
 * Migrasi fitur: dompet, alert email, skema terkait.
 * Jalankan sekali: node migrate-features-123.js
 */
const { ensureSchema } = require('./lib/schema');

async function main() {
    try {
        await ensureSchema();
        console.log('Migrasi skema selesai (wallets, alerts, dll.).');
        process.exit(0);
    } catch (e) {
        console.error('Migrasi gagal:', e);
        process.exit(1);
    }
}

main();
