import { useState, useEffect } from 'react';
import api from '../services/api';
import { CalendarClock, Plus, Trash2, Download, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';

export default function Subscriptions() {
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSubId, setEditingSubId] = useState(null);
  const [subForm, setSubForm] = useState({ name: '', amount: '', billing_cycle: 'monthly', next_billing_date: '' });
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await api.get('/subscriptions');
      setSubscriptions(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const resetSubForm = () => {
    setEditingSubId(null);
    setSubForm({ name: '', amount: '', billing_cycle: 'monthly', next_billing_date: '' });
  };

  const openAddSubModal = () => {
    resetSubForm();
    setShowSubModal(true);
  };

  const openEditSubModal = (sub) => {
    const dateStr = typeof sub.next_billing_date === 'string' ? sub.next_billing_date.split('T')[0] : sub.next_billing_date;
    setEditingSubId(sub.id);
    setSubForm({
      name: sub.name,
      amount: String(sub.amount),
      billing_cycle: sub.billing_cycle,
      next_billing_date: dateStr
    });
    setShowSubModal(true);
  };

  const closeSubModal = () => {
    setShowSubModal(false);
    resetSubForm();
  };

  const handleSaveSub = async (e) => {
    e.preventDefault();
    try {
      if (editingSubId) {
        await api.put(`/subscriptions/${editingSubId}`, subForm);
        showToast(`Langganan "${subForm.name}" berhasil diperbarui.`, 'success');
      } else {
        await api.post('/subscriptions', subForm);
        showToast(`Langganan "${subForm.name}" berhasil ditambahkan.`, 'success');
      }
      closeSubModal();
      fetchSubscriptions();
    } catch (e) {
      showToast(e.response?.data?.error || (editingSubId ? 'Gagal memperbarui langganan.' : 'Gagal menambah langganan.'), 'error');
    }
  };

  const requestDelete = (id) => {
    setConfirmData({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/subscriptions/${confirmData.id}`);
      fetchSubscriptions();
      showToast('Langganan berhasil dihapus.', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menghapus langganan.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  const exportToExcel = () => {
    const wsData = subscriptions.map(s => ({
      'Nama Layanan': s.name,
      'Biaya': parseFloat(s.amount),
      'Siklus': s.billing_cycle === 'monthly' ? 'Bulanan' : 'Tahunan',
      'Tagihan Berikutnya': new Date(s.next_billing_date).toLocaleDateString('id-ID'),
      'Dibuat Pada': new Date(s.created_at).toLocaleDateString('id-ID')
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Langganan Aktif");
    XLSX.writeFile(wb, "Data_Langganan.xlsx");
  };

  return (
    <div className="glass-panel page-container fade-in" style={{ minHeight: 'calc(100vh - 150px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Pelacak Langganan</h2>
          <p>Jangan sampai terlewat membayar tagihan layanan rutin Anda.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={exportToExcel} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <Download size={18} /> Ekspor Excel
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddSubModal}>
            <Plus size={18} /> Tambah Langganan
          </button>
        </div>
      </div>

      <div className="subscription-list">
        {subscriptions.map(sub => {
          const date = new Date(sub.next_billing_date);
          const isSoon = (date.getTime() - new Date().getTime()) < (3 * 24 * 60 * 60 * 1000); // Less than 3 days

          return (
            <div
              key={sub.id}
              className="subscription-item clickable-row"
              style={{ ...(isSoon ? { borderLeftColor: 'var(--danger)' } : {}), cursor: 'pointer' }}
              onClick={() => openEditSubModal(sub)}
              title="Klik untuk edit"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <CalendarClock size={24} color={isSoon ? 'var(--danger)' : 'var(--text-main)'} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{sub.name}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Tagihan berikutnya: <span style={{ color: isSoon ? 'var(--danger)' : 'inherit', fontWeight: isSoon ? 'bold' : 'normal' }}>{date.toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              </div>
              
              <div className="action-btns" style={{ gap: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Rp {parseFloat(sub.amount).toLocaleString('id-ID')}</div>
                  <span className={`badge ${sub.billing_cycle}`}>{sub.billing_cycle === 'monthly' ? 'Bulanan' : 'Tahunan'}</span>
                </div>
                <button type="button" onClick={() => openEditSubModal(sub)} className="btn-icon-edit" title="Edit"><Pencil size={18} /></button>
                <button type="button" onClick={() => requestDelete(sub.id)} style={{ background: 'transparent', color: 'var(--danger)', padding: '0.5rem' }} title="Hapus"><Trash2 size={18} /></button>
              </div>
            </div>
          );
        })}
        {subscriptions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <CalendarClock size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Anda tidak memiliki langganan aktif.</p>
          </div>
        )}
      </div>

      {/* Add Sub Modal */}
      {showSubModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingSubId ? 'Edit Langganan' : 'Tambah Langganan'}</h2>
            <form onSubmit={handleSaveSub}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nama Layanan (contoh: Netflix)</label>
                <input type="text" className="input-field" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Biaya (Rp)</label>
                <input type="number" className="input-field" value={subForm.amount} onChange={e => setSubForm({ ...subForm, amount: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Siklus Penagihan</label>
                <select className="input-field" value={subForm.billing_cycle} onChange={e => setSubForm({ ...subForm, billing_cycle: e.target.value })}>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tanggal Tagihan Berikutnya</label>
                <input type="date" className="input-field" value={subForm.next_billing_date} onChange={e => setSubForm({ ...subForm, next_billing_date: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeSubModal} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                <button type="submit" className="btn-primary">{editingSubId ? 'Perbarui' : 'Simpan Langganan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomConfirm 
        isOpen={confirmData.isOpen}
        title="Hapus Langganan"
        message="Apakah Anda yakin ingin menghapus catatan langganan ini? Data yang dihapus tidak dapat dikembalikan."
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
      />
    </div>
  );
}
