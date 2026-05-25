import { useState, useEffect } from 'react';
import api from '../services/api';
import { Wallet, Plus, Trash2, Download, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';
import { fetchCategories, categoryNames } from '../hooks/useCategories';

export default function Budgets() {
  const { showToast } = useToast();
  const [budgets, setBudgets] = useState([]);
  const [userCategories, setUserCategories] = useState([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState(null);
  const [budgetForm, setBudgetForm] = useState({ category: 'Makanan', limit_amount: '' });
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });
  const categories = categoryNames(userCategories).length > 0
    ? categoryNames(userCategories)
    : ['Makanan', 'Transportasi', 'Hiburan', 'Tagihan', 'Gaji', 'Lainnya'];
  const currentMonth = new Date().toISOString().substring(0, 7);

  useEffect(() => {
    fetchBudgets();
    fetchCategories().then(setUserCategories).catch(console.error);
  }, []);

  const fetchBudgets = async () => {
    try {
      const res = await api.get('/budgets');
      setBudgets(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const resetBudgetForm = () => {
    setEditingBudgetId(null);
    setBudgetForm({ category: 'Makanan', limit_amount: '' });
  };

  const openAddBudgetModal = () => {
    resetBudgetForm();
    setShowBudgetModal(true);
  };

  const openEditBudgetModal = (budget) => {
    setEditingBudgetId(budget.id);
    setBudgetForm({ category: budget.category, limit_amount: String(budget.limit_amount) });
    setShowBudgetModal(true);
  };

  const closeBudgetModal = () => {
    setShowBudgetModal(false);
    resetBudgetForm();
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...budgetForm, month: currentMonth };
      if (editingBudgetId) {
        await api.put(`/budgets/${editingBudgetId}`, payload);
        showToast(`Anggaran ${budgetForm.category} berhasil diperbarui.`, 'success');
      } else {
        await api.post('/budgets', payload);
        showToast(`Anggaran ${budgetForm.category} berhasil disimpan.`, 'success');
      }
      closeBudgetModal();
      fetchBudgets();
    } catch (e) {
      showToast(e.response?.data?.error || (editingBudgetId ? 'Gagal memperbarui anggaran.' : 'Gagal menyimpan anggaran.'), 'error');
    }
  };

  const requestDelete = (id) => {
    setConfirmData({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/budgets/${confirmData.id}`);
      fetchBudgets();
      showToast('Batas anggaran berhasil dihapus.', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menghapus anggaran.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  const exportToExcel = () => {
    const wsData = budgets.filter(b => b.month === currentMonth).map(b => ({
      'Bulan': b.month,
      'Kategori': b.category,
      'Batas Anggaran': parseFloat(b.limit_amount),
      'Dibuat Pada': new Date(b.created_at).toLocaleDateString('id-ID')
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anggaran Bulanan");
    XLSX.writeFile(wb, "Data_Anggaran.xlsx");
  };

  return (
    <div className="glass-panel page-container fade-in" style={{ minHeight: 'calc(100vh - 150px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Batas Anggaran Bulanan</h2>
          <p>Tetapkan batas pengeluaran untuk setiap kategori bulan ini ({new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}).</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={exportToExcel} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <Download size={18} /> Ekspor Excel
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddBudgetModal}>
            <Plus size={18} /> Buat Anggaran
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {budgets.filter(b => b.month === currentMonth).map(budget => (
          <div
            key={budget.id}
            className="glass-panel clickable-row"
            style={{ background: 'rgba(15, 23, 42, 0.4)', cursor: 'pointer' }}
            onClick={() => openEditBudgetModal(budget)}
            title="Klik untuk edit"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={20} color="var(--success)" />
                <h3 style={{ fontWeight: 600 }}>{budget.category}</h3>
              </div>
              <div className="action-btns" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => openEditBudgetModal(budget)} className="btn-icon-edit" title="Edit"><Pencil size={16} /></button>
                <button type="button" onClick={() => requestDelete(budget.id)} style={{ background: 'transparent', color: 'var(--danger)', padding: '0.25rem' }} title="Hapus"><Trash2 size={16} /></button>
              </div>
            </div>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Batas Bulanan</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Rp {parseFloat(budget.limit_amount).toLocaleString('id-ID')}</div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Anda akan mendapat peringatan jika pengeluaran melebihi batas ini.</p>
          </div>
        ))}
        {budgets.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Wallet size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Anda belum menetapkan batas anggaran untuk bulan ini.</p>
          </div>
        )}
      </div>

      {/* Add Budget Modal */}
      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingBudgetId ? 'Edit Anggaran' : 'Tetapkan Anggaran Kategori'}</h2>
            <form onSubmit={handleSaveBudget}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Kategori</label>
                <select className="input-field" value={budgetForm.category} onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Batas Nominal (Rp)</label>
                <input type="number" className="input-field" value={budgetForm.limit_amount} onChange={e => setBudgetForm({ ...budgetForm, limit_amount: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeBudgetModal} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                <button type="submit" className="btn-primary">{editingBudgetId ? 'Perbarui' : 'Simpan Anggaran'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomConfirm 
        isOpen={confirmData.isOpen}
        title="Hapus Anggaran"
        message="Apakah Anda yakin ingin menghapus batas anggaran ini? Data yang dihapus tidak dapat dikembalikan."
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
      />
    </div>
  );
}
