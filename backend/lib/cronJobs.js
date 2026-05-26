const pool = require('../db');
const { sendAlertEmail } = require('./alertEmail');

const fmt = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

async function markAlertSent(conn, userId, alertKey, today) {
    await conn.query(
        'INSERT IGNORE INTO alert_sent_log (user_id, alert_key, sent_on) VALUES (?, ?, ?)',
        [userId, alertKey, today]
    );
}

async function wasAlertSent(conn, userId, alertKey, today) {
    const [rows] = await conn.query(
        'SELECT 1 FROM alert_sent_log WHERE user_id = ? AND alert_key = ? AND sent_on = ? LIMIT 1',
        [userId, alertKey, today]
    );
    return rows.length > 0;
}

async function processEmailAlerts(today) {
    const month = today.slice(0, 7);
    let sent = 0;

    // --- Anggaran ≥80% (1 query agregat) ---
    const [budgetAlerts] = await pool.query(
        `SELECT u.id AS user_id, u.email, u.username, b.id AS budget_id, b.category,
                b.limit_amount,
                COALESCE(SUM(t.amount), 0) AS spent
         FROM users u
         LEFT JOIN user_alert_prefs p ON p.user_id = u.id
         JOIN budgets b ON b.user_id = u.id AND b.month = ?
         WHERE (p.budget_on IS NULL OR p.budget_on = 1)
         LEFT JOIN transactions t ON t.user_id = u.id AND t.type = 'expense'
              AND t.category = b.category AND t.date >= ? AND t.date < DATE_ADD(?, INTERVAL 1 MONTH)
         GROUP BY u.id, u.email, u.username, b.id, b.category, b.limit_amount
         HAVING spent >= b.limit_amount * 0.8`,
        [month, `${month}-01`, `${month}-01`]
    );

    for (const row of budgetAlerts) {
        const pct = Math.round((row.spent / row.limit_amount) * 100);
        const alertKey = `budget:${row.budget_id}:${month}`;
        const conn = await pool.getConnection();
        try {
            if (await wasAlertSent(conn, row.user_id, alertKey, today)) continue;
            const over = row.spent >= row.limit_amount;
            await sendAlertEmail(
                row.email,
                over ? `Anggaran ${row.category} terlampaui` : `Anggaran ${row.category} hampir habis`,
                `<p>Halo <strong>${row.username}</strong>,</p>
                 <p>Kategori <strong>${row.category}</strong> bulan ini sudah <strong>${pct}%</strong>
                 (${fmt(row.spent)} dari ${fmt(row.limit_amount)}).</p>
                 ${over ? '<p style="color:#ef4444;">Batas anggaran telah terlampaui.</p>' : '<p style="color:#f59e0b;">Segera evaluasi pengeluaran Anda.</p>'}`
            );
            await markAlertSent(conn, row.user_id, alertKey, today);
            sent++;
        } catch (e) {
            console.error('budget alert', row.user_id, e.message);
        } finally {
            conn.release();
        }
    }

    // --- Langganan jatuh tempo ≤3 hari (1 query) ---
    const [subAlerts] = await pool.query(
        `SELECT u.id AS user_id, u.email, u.username, s.id AS sub_id, s.name, s.amount, s.next_billing_date
         FROM users u
         LEFT JOIN user_alert_prefs p ON p.user_id = u.id
         JOIN subscriptions s ON s.user_id = u.id
         WHERE (p.subscription_on IS NULL OR p.subscription_on = 1)
         WHERE s.next_billing_date BETWEEN ? AND DATE_ADD(?, INTERVAL 3 DAY)`,
        [today, today]
    );

    for (const row of subAlerts) {
        const alertKey = `sub:${row.sub_id}:${row.next_billing_date}`;
        const conn = await pool.getConnection();
        try {
            if (await wasAlertSent(conn, row.user_id, alertKey, today)) continue;
            const due = new Date(row.next_billing_date).toLocaleDateString('id-ID');
            await sendAlertEmail(
                row.email,
                `Tagihan ${row.name} segera jatuh tempo`,
                `<p>Halo <strong>${row.username}</strong>,</p>
                 <p>Langganan <strong>${row.name}</strong> (${fmt(row.amount)}) jatuh tempo pada <strong>${due}</strong>.</p>`
            );
            await markAlertSent(conn, row.user_id, alertKey, today);
            sent++;
        } catch (e) {
            console.error('sub alert', row.user_id, e.message);
        } finally {
            conn.release();
        }
    }

    // --- Tabungan milestone 50% / 100% (1 query) ---
    const [savingsAlerts] = await pool.query(
        `SELECT u.id AS user_id, u.email, u.username, g.id AS goal_id, g.name,
                g.target_amount, g.current_amount,
                ROUND((g.current_amount / NULLIF(g.target_amount, 0)) * 100) AS pct
         FROM users u
         LEFT JOIN user_alert_prefs p ON p.user_id = u.id
         JOIN savings_goals g ON g.user_id = u.id
         WHERE (p.savings_on IS NULL OR p.savings_on = 1)
         WHERE g.target_amount > 0
           AND (
             (g.current_amount >= g.target_amount * 0.5 AND g.current_amount < g.target_amount * 0.75)
             OR (g.current_amount >= g.target_amount)
           )`
    );

    for (const row of savingsAlerts) {
        const milestone = row.pct >= 100 ? '100' : '50';
        const alertKey = `saving:${row.goal_id}:${milestone}`;
        const conn = await pool.getConnection();
        try {
            if (await wasAlertSent(conn, row.user_id, alertKey, today)) continue;
            const done = row.pct >= 100;
            await sendAlertEmail(
                row.email,
                done ? `Target tabungan "${row.name}" tercapai!` : `Target tabungan "${row.name}" setengah jalan`,
                `<p>Halo <strong>${row.username}</strong>,</p>
                 <p>Progress <strong>${row.name}</strong>: ${row.pct}% (${fmt(row.current_amount)} / ${fmt(row.target_amount)}).</p>
                 ${done ? '<p style="color:#10b981;">Selamat, target Anda tercapai!</p>' : ''}`
            );
            await markAlertSent(conn, row.user_id, alertKey, today);
            sent++;
        } catch (e) {
            console.error('saving alert', row.user_id, e.message);
        } finally {
            conn.release();
        }
    }

    // Bersihkan log > 90 hari (ringan, sekali per cron)
    await pool.query('DELETE FROM alert_sent_log WHERE sent_on < DATE_SUB(?, INTERVAL 90 DAY)', [today]);

    return { sent };
}

async function runDailyCron() {
    const today = new Date().toISOString().slice(0, 10);
    const alerts = await processEmailAlerts(today);
    return { today, alerts };
}

module.exports = { runDailyCron, processEmailAlerts };
