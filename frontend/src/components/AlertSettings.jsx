import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Bell } from 'lucide-react';

export default function AlertSettings() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState({
    budget_on: true,
    subscription_on: true,
    savings_on: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/alerts/settings')
      .then((res) => setPrefs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/alerts/settings', prefs);
      showToast('Preferensi notifikasi email disimpan.', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Memuat notifikasi...</p>;

  const row = (key, label, desc) => (
    <label key={key} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1rem', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={prefs[key]}
        onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
        style={{ marginTop: 4 }}
      />
      <span>
        <strong style={{ display: 'block', fontSize: '0.95rem' }}>{label}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{desc}</span>
      </span>
    </label>
  );

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Bell size={18} /> Notifikasi Email
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Peringatan dikirim maksimal sekali per hari per jenis (hemat kuota email & database).
      </p>
      {row('budget_on', 'Anggaran hampir habis', 'Email saat pengeluaran kategori ≥ 80% limit bulan ini.')}
      {row('subscription_on', 'Tagihan langganan', 'Email 3 hari sebelum jatuh tempo langganan.')}
      {row('savings_on', 'Target tabungan', 'Email saat progress 50% atau 100%.')}
      <button type="button" className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: '0.5rem' }}>
        {saving ? 'Menyimpan...' : 'Simpan Notifikasi'}
      </button>
    </div>
  );
}
