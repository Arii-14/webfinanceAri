import { useState, useEffect } from 'react';
import api from '../services/api';
import { HandCoins, Plus, Trash2, Pencil, Banknote } from 'lucide-react';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';

export default function Debts() {
  const { showToast } = useToast();
  const [debts, setDebts] = useState([]);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payments, setPayments] = useState([]);
  const [debtForm, setDebtForm] = useState({
    direction: 'owe',
    counterparty: '',
    amount: '',
    due_date: '',
    note: '',
  });
  const [payForm, setPayForm] = useState({ amount: '', paid_at: new Date().toISOString().split('T')[0], note: '' });
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  const loadDebts = async () => {
    try {
      const res = await api.get('/debts');
      setDebts(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDebts();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setDebtForm({ direction: 'owe', counterparty: '', amount: '', due_date: '', note: '' });
    setShowDebtModal(true);
  };

  const openEdit = (d) => {
    if (parseFloat(d.paid_amount) > 0) {
      showToast('Utang yang sudah ada cicilan tidak bisa diedit. Catat pelunasan saja.', 'warning');
      return;
    }
    setEditingId(d.id);
    setDebtForm({
      direction: d.direction,
      counterparty: d.counterparty,
      amount: String(d.amount),
      due_date: d.due_date ? String(d.due_date).split('T')[0] : '',
      note: d.note || '',
    });
    setShowDebtModal(true);
  };

  const openPay = async (d) => {
    setSelectedDebt(d);
    setPayForm({
      amount: String(parseFloat(d.remaining)),
      paid_at: new Date().toISOString().split('T')[0],
      note: '',
    });
    try {
      const res = await api.get(`/debts/${d.id}/payments`);
      setPayments(res.data);
    } catch {
      setPayments([]);
    }
    setShowPayModal(true);
  };

  const handleSaveDebt = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...debtForm,
        amount: parseFloat(debtForm.amount),
        due_date: debtForm.due_date || null,
      };
      if (editingId) {
        await api.put(`/debts/${editingId}`, payload);
        showToast('Data utang diperbarui.', 'success');
      } else {
        await api.post('/debts', payload);
        showToast('Utang/piutang dicatat.', 'success');
      }
      setShowDebtModal(false);
      loadDebts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan.', 'error');
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/debts/${selectedDebt.id}/pay`, {
        ...payForm,
        amount: parseFloat(payForm.amount),
      });
      showToast(
        res.data.is_paid ? 'Utang lunas!' : `Cicilan Rp ${res.data.applied.toLocaleString('id-ID')} tercatat.`,
        'success'
      );
      setShowPayModal(false);
      loadDebts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mencatat cicilan.', 'error');
    }
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/debts/${confirmData.id}`);
      showToast('Data dihapus.', 'success');
      loadDebts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menghapus.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  const owe = debts.filter((d) => d.direction === 'owe' && !d.is_paid);
  const lent = debts.filter((d) => d.direction === 'lent' && !d.is_paid);
  const paid = debts.filter((d) => d.is_paid);

  const card = (d) => {
    const pct = Math.min(100, (parseFloat(d.paid_amount) / parseFloat(d.amount)) * 100);
    const overdue = d.due_date && !d.is_paid && new Date(d.due_date) < new Date();
    return (
      <div key={d.id} className="glass-panel stat-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <strong>{d.counterparty}</strong>
          <span style={{ fontSize: '0.75rem', color: d.direction === 'owe' ? 'var(--danger)' : 'var(--success)' }}>
            {d.direction === 'owe' ? 'Saya hutang' : 'Piutang saya'}
          </span>
        </div>
        <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          Sisa: Rp {parseFloat(d.remaining).toLocaleString('id-ID')}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 400 }}> / {parseFloat(d.amount).toLocaleString('id-ID')}</span>
        </p>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, margin: '0.75rem 0' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: d.is_paid ? 'var(--success)' : 'var(--primary)', borderRadius: 4 }} />
        </div>
        {d.due_date && (
          <p style={{ fontSize: '0.8rem', color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
            Jatuh tempo: {new Date(d.due_date).toLocaleDateString('id-ID')}
            {overdue ? ' (lewat)' : ''}
          </p>
        )}
        {d.note && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{d.note}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {!d.is_paid && (
            <button type="button" className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => openPay(d)}>
              <Banknote size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Cicilan
            </button>
          )}
          <button type="button" className="btn-icon-edit" onClick={() => openEdit(d)}><Pencil size={16} /></button>
          <button type="button" onClick={() => setConfirmData({ isOpen: true, id: d.id })} style={{ background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel page-container fade-in" style={{ minHeight: 'calc(100vh - 150px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HandCoins size={22} /> Utang & Piutang
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Hutang aktif: {owe.length} · Piutang aktif: {lent.length}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Catat Baru
        </button>
      </div>

      {owe.length > 0 && (
        <>
          <h3 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>Saya Hutang</h3>
          <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>{owe.map(card)}</div>
        </>
      )}
      {lent.length > 0 && (
        <>
          <h3 style={{ marginBottom: '1rem', color: 'var(--success)' }}>Piutang Saya</h3>
          <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>{lent.map(card)}</div>
        </>
      )}
      {paid.length > 0 && (
        <>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Sudah Lunas</h3>
          <div className="dashboard-grid">{paid.map(card)}</div>
        </>
      )}
      {debts.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Belum ada catatan utang/piutang.</p>
      )}

      {showDebtModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Edit Catatan' : 'Catat Utang / Piutang'}</h2>
            <form onSubmit={handleSaveDebt}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <label style={{ flex: 1 }}><input type="radio" checked={debtForm.direction === 'owe'} onChange={() => setDebtForm({ ...debtForm, direction: 'owe' })} /> Saya hutang</label>
                <label style={{ flex: 1 }}><input type="radio" checked={debtForm.direction === 'lent'} onChange={() => setDebtForm({ ...debtForm, direction: 'lent' })} /> Orang hutang ke saya</label>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Nama orang / pihak</label>
                <input className="input-field" value={debtForm.counterparty} onChange={(e) => setDebtForm({ ...debtForm, counterparty: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Total nominal (Rp)</label>
                <input type="number" className="input-field" value={debtForm.amount} onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })} required min="1" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Jatuh tempo (opsional)</label>
                <input type="date" className="input-field" value={debtForm.due_date} onChange={(e) => setDebtForm({ ...debtForm, due_date: e.target.value })} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="field-label">Catatan</label>
                <input className="input-field" value={debtForm.note} onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowDebtModal(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayModal && selectedDebt && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '0.5rem' }}>Cicilan — {selectedDebt.counterparty}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Sisa: Rp {parseFloat(selectedDebt.remaining).toLocaleString('id-ID')}
            </p>
            <form onSubmit={handlePay}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Nominal cicilan (Rp)</label>
                <input type="number" className="input-field" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required min="1" max={parseFloat(selectedDebt.remaining)} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Tanggal</label>
                <input type="date" className="input-field" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Catatan</label>
                <input className="input-field" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
              </div>
              {payments.length > 0 && (
                <div style={{ marginBottom: '1rem', maxHeight: 120, overflowY: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Riwayat cicilan:</strong>
                  <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                    {payments.map((p) => (
                      <li key={p.id}>{new Date(p.paid_at).toLocaleDateString('id-ID')} — Rp {parseFloat(p.amount).toLocaleString('id-ID')}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPayModal(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>Batal</button>
                <button type="submit" className="btn-primary">Catat Cicilan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomConfirm
        isOpen={confirmData.isOpen}
        title="Hapus Catatan"
        message="Utang/piutang dan riwayat cicilannya akan dihapus."
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
        isDanger
      />
    </div>
  );
}
