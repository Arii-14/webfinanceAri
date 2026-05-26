import { useState, useEffect } from 'react';
import api from '../services/api';
import { Target, Plus, Trash2, Download, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';

export default function Savings() {
  const { showToast } = useToast();
  const [goals, setGoals] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({ name: '', target_amount: '', current_amount: '' });
  const [addAmount, setAddAmount] = useState('');
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const res = await api.get('/savings');
      setGoals(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const resetGoalForm = () => {
    setEditingGoalId(null);
    setGoalForm({ name: '', target_amount: '', current_amount: '' });
  };

  const openAddGoalModal = () => {
    resetGoalForm();
    setShowGoalModal(true);
  };

  const openEditGoalModal = (goal) => {
    setEditingGoalId(goal.id);
    setGoalForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount ?? 0)
    });
    setShowGoalModal(true);
  };

  const closeGoalModal = () => {
    setShowGoalModal(false);
    resetGoalForm();
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: goalForm.name,
        target_amount: parseFloat(goalForm.target_amount),
        current_amount: parseFloat(goalForm.current_amount || 0)
      };
      if (editingGoalId) {
        await api.put(`/savings/${editingGoalId}`, payload);
        showToast(`Target "${goalForm.name}" berhasil diperbarui.`, 'success');
      } else {
        await api.post('/savings', { name: payload.name, target_amount: payload.target_amount });
        showToast(`Target tabungan "${goalForm.name}" berhasil dibuat.`, 'success');
      }
      closeGoalModal();
      fetchGoals();
    } catch (e) {
      showToast(e.response?.data?.error || (editingGoalId ? 'Gagal memperbarui target.' : 'Gagal membuat target tabungan.'), 'error');
    }
  };

  const handleAddMoney = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/savings/${selectedGoal.id}/add`, { amount: parseFloat(addAmount) });
      const nominal = parseFloat(addAmount).toLocaleString('id-ID');
      setShowAddMoneyModal(false);
      setSelectedGoal(null);
      setAddAmount('');
      fetchGoals();
      showToast(`Saldo Rp ${nominal} berhasil ditambahkan ke target.`, 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menambah saldo.', 'error');
    }
  };

  const requestDelete = (id) => {
    setConfirmData({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/savings/${confirmData.id}`);
      fetchGoals();
      showToast('Target tabungan berhasil dihapus.', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menghapus target.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  const exportToExcel = () => {
    const wsData = goals.map(g => ({
      'Nama Target': g.name,
      'Target Nominal': parseFloat(g.target_amount),
      'Terkumpul': parseFloat(g.current_amount),
      'Sisa': parseFloat(g.target_amount) - parseFloat(g.current_amount),
      'Progres (%)': ((parseFloat(g.current_amount) / parseFloat(g.target_amount)) * 100).toFixed(2),
      'Dibuat Pada': new Date(g.created_at).toLocaleDateString('id-ID')
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Target Tabungan");
    XLSX.writeFile(wb, "Data_Target_Tabungan.xlsx");
  };

  return (
    <div className="glass-panel page-container fade-in" style={{ minHeight: 'calc(100vh - 150px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Target Tabungan</h2>
          <p>Pantau progres pencapaian target keuangan Anda.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={exportToExcel} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <Download size={18} /> Ekspor Excel
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddGoalModal}>
            <Plus size={18} /> Target Baru
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {goals.map(goal => {
          const progress = Math.min((parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100, 100).toFixed(1);
          return (
            <div
              key={goal.id}
              className="glass-panel clickable-row"
              style={{ background: 'rgba(15, 23, 42, 0.4)', cursor: 'pointer' }}
              onClick={() => openEditGoalModal(goal)}
              title="Klik untuk edit"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Target size={20} color="var(--primary)" />
                  <h3 style={{ fontWeight: 600 }}>{goal.name}</h3>
                </div>
                <div className="action-btns" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => openEditGoalModal(goal)} className="btn-icon-edit" title="Edit"><Pencil size={16} /></button>
                  <button type="button" onClick={() => requestDelete(goal.id)} style={{ background: 'transparent', color: 'var(--danger)' }} title="Hapus"><Trash2 size={16} /></button>
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  <span>Rp {parseFloat(goal.current_amount).toLocaleString('id-ID')}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Rp {parseFloat(goal.target_amount).toLocaleString('id-ID')}</span>
                </div>
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.25rem' }}>Tercapai {progress}%</div>
              </div>

              <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                onClick={(e) => { e.stopPropagation(); setSelectedGoal(goal); setShowAddMoneyModal(true); }}
              >
                + Tambah Saldo
              </button>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Target size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Anda belum membuat target tabungan apapun.</p>
          </div>
        )}
      </div>

      {/* Tambah / Edit Target Modal */}
      {showGoalModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingGoalId ? 'Edit Target Tabungan' : 'Buat Target Tabungan'}</h2>
            <form onSubmit={handleSaveGoal}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nama Target (contoh: Beli Laptop)</label>
                <input type="text" className="input-field" value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Jumlah Target (Rp)</label>
                <input type="number" className="input-field" value={goalForm.target_amount} onChange={e => setGoalForm({ ...goalForm, target_amount: e.target.value })} required />
              </div>
              {editingGoalId && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Saldo Terkumpul (Rp)</label>
                  <input type="number" className="input-field" value={goalForm.current_amount} onChange={e => setGoalForm({ ...goalForm, current_amount: e.target.value })} required min="0" />
                </div>
              )}
              {!editingGoalId && <div style={{ marginBottom: '1.5rem' }} />}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeGoalModal} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                <button type="submit" className="btn-primary">{editingGoalId ? 'Perbarui' : 'Buat Target'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Money Modal */}
      {showAddMoneyModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Tambah Saldo untuk {selectedGoal?.name}</h2>
            <form onSubmit={handleAddMoney}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Jumlah yang ditabung (Rp)</label>
                <input type="number" className="input-field" value={addAmount} onChange={e => setAddAmount(e.target.value)} required placeholder="0" />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowAddMoneyModal(false); setSelectedGoal(null); }} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomConfirm 
        isOpen={confirmData.isOpen}
        title="Hapus Target"
        message="Apakah Anda yakin ingin menghapus target tabungan ini? Data yang dihapus tidak dapat dikembalikan."
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
      />
    </div>
  );
}
