import { useState, useEffect } from 'react';
import api from '../services/api';
import { Landmark, Plus, Trash2, ArrowLeftRight, Pencil } from 'lucide-react';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';

const TYPE_LABELS = { cash: 'Tunai', bank: 'Bank', ewallet: 'E-Wallet' };

export default function Wallets() {
  const { showToast } = useToast();
  const [wallets, setWallets] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [walletForm, setWalletForm] = useState({ name: '', type: 'cash' });
  const [transferForm, setTransferForm] = useState({
    from_wallet_id: '',
    to_wallet_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  const loadData = async () => {
    try {
      const [wRes, tRes] = await Promise.all([
        api.get('/wallets'),
        api.get('/wallets/transfers'),
      ]);
      setWallets(wRes.data);
      setTransfers(tRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalBalance = wallets.reduce((s, w) => s + parseFloat(w.balance || 0), 0);

  const resetWalletForm = () => {
    setEditingId(null);
    setWalletForm({ name: '', type: 'cash' });
  };

  const openAddWallet = () => {
    resetWalletForm();
    setShowWalletModal(true);
  };

  const openEditWallet = (w) => {
    setEditingId(w.id);
    setWalletForm({ name: w.name, type: w.type });
    setShowWalletModal(true);
  };

  const handleSaveWallet = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/wallets/${editingId}`, walletForm);
        showToast(`Dompet "${walletForm.name}" diperbarui.`, 'success');
      } else {
        await api.post('/wallets', walletForm);
        showToast(`Dompet "${walletForm.name}" dibuat.`, 'success');
      }
      setShowWalletModal(false);
      resetWalletForm();
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan dompet.', 'error');
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/wallets/transfer', {
        ...transferForm,
        amount: parseFloat(transferForm.amount),
        from_wallet_id: Number(transferForm.from_wallet_id),
        to_wallet_id: Number(transferForm.to_wallet_id),
      });
      showToast('Transfer berhasil.', 'success');
      setShowTransferModal(false);
      setTransferForm({
        from_wallet_id: '',
        to_wallet_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        note: '',
      });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Transfer gagal.', 'error');
    }
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/wallets/${confirmData.id}`);
      showToast('Dompet dihapus.', 'success');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menghapus.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  return (
    <div className="glass-panel page-container fade-in" style={{ minHeight: 'calc(100vh - 150px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={22} /> Dompet Keuangan
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Total saldo dompet: <strong style={{ color: 'var(--success)' }}>Rp {totalBalance.toLocaleString('id-ID')}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => setShowTransferModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeftRight size={18} /> Transfer
          </button>
          <button type="button" className="btn-primary" onClick={openAddWallet} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Dompet Baru
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        {wallets.map((w) => (
          <div key={w.id} className="glass-panel stat-card" style={{ position: 'relative' }}>
            {w.is_default ? (
              <span style={{ position: 'absolute', top: 12, right: 12, fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 8 }}>Utama</span>
            ) : null}
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{w.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{TYPE_LABELS[w.type] || w.type}</p>
            <div className="amount" style={{ fontSize: '1.35rem' }}>Rp {parseFloat(w.balance).toLocaleString('id-ID')}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn-icon-edit" onClick={() => openEditWallet(w)} title="Edit"><Pencil size={16} /></button>
              {!w.is_default && (
                <button type="button" onClick={() => setConfirmData({ isOpen: true, id: w.id })} style={{ background: 'transparent', color: 'var(--danger)' }} title="Hapus"><Trash2 size={16} /></button>
              )}
            </div>
          </div>
        ))}
        {wallets.length === 0 && (
          <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1' }}>Belum ada dompet. Buat dompet pertama Anda.</p>
        )}
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Riwayat Transfer (50 terakhir)</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Dari</th>
                <th>Ke</th>
                <th>Nominal</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('id-ID')}</td>
                  <td>{t.from_name}</td>
                  <td>{t.to_name}</td>
                  <td>Rp {parseFloat(t.amount).toLocaleString('id-ID')}</td>
                  <td>{t.note || '—'}</td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada transfer</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showWalletModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Edit Dompet' : 'Dompet Baru'}</h2>
            <form onSubmit={handleSaveWallet}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Nama</label>
                <input className="input-field" value={walletForm.name} onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="field-label">Tipe</label>
                <select className="input-field" value={walletForm.type} onChange={(e) => setWalletForm({ ...walletForm, type: e.target.value })}>
                  <option value="cash">Tunai</option>
                  <option value="bank">Bank</option>
                  <option value="ewallet">E-Wallet</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowWalletModal(false); resetWalletForm(); }} style={{ background: 'transparent', color: 'var(--text-muted)' }}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Transfer Antar Dompet</h2>
            <form onSubmit={handleTransfer}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Dari dompet</label>
                <select className="input-field" value={transferForm.from_wallet_id} onChange={(e) => setTransferForm({ ...transferForm, from_wallet_id: e.target.value })} required>
                  <option value="">Pilih...</option>
                  {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} (Rp {parseFloat(w.balance).toLocaleString('id-ID')})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Ke dompet</label>
                <select className="input-field" value={transferForm.to_wallet_id} onChange={(e) => setTransferForm({ ...transferForm, to_wallet_id: e.target.value })} required>
                  <option value="">Pilih...</option>
                  {wallets.filter((w) => String(w.id) !== String(transferForm.from_wallet_id)).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Nominal (Rp)</label>
                <input type="number" className="input-field" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} required min="1" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Tanggal</label>
                <input type="date" className="input-field" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="field-label">Catatan</label>
                <input className="input-field" value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} placeholder="Opsional" />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowTransferModal(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>Batal</button>
                <button type="submit" className="btn-primary">Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomConfirm
        isOpen={confirmData.isOpen}
        title="Hapus Dompet"
        message="Dompet tanpa transaksi terhubung dapat dihapus. Lanjutkan?"
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
        isDanger
      />
    </div>
  );
}
