import { useState, useEffect } from 'react';
import api from '../services/api';
import { Tags, Plus, Trash2, Pencil } from 'lucide-react';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';
import { fetchCategories, invalidateCategoriesCache } from '../hooks/useCategories';

const PRESET_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#64748b'];

export default function Categories() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[0] });
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  const load = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', color: PRESET_COLORS[0] });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name, color: c.color });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, form);
        showToast(`Kategori "${form.name}" diperbarui.`, 'success');
      } else {
        await api.post('/categories', form);
        showToast(`Kategori "${form.name}" ditambahkan.`, 'success');
      }
      invalidateCategoriesCache();
      setShowModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan.', 'error');
    }
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/categories/${confirmData.id}`);
      invalidateCategoriesCache();
      showToast('Kategori dihapus.', 'success');
      load();
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
            <Tags size={22} /> Kategori Kustom
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Dipakai di transaksi dan anggaran.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Kategori Baru
        </button>
      </div>

      <div className="dashboard-grid">
        {categories.map((c) => (
          <div key={c.id} className="glass-panel stat-card" style={{ borderLeft: `4px solid ${c.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem' }}>{c.name}</h3>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.color }} title={c.color} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn-icon-edit" onClick={() => openEdit(c)}><Pencil size={16} /></button>
              <button type="button" onClick={() => setConfirmData({ isOpen: true, id: c.id })} style={{ background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Edit Kategori' : 'Kategori Baru'}</h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">Nama</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={50} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="field-label">Warna</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setForm({ ...form, color: col })}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: col,
                        border: form.color === col ? '3px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomConfirm
        isOpen={confirmData.isOpen}
        title="Hapus Kategori"
        message="Hanya kategori yang belum dipakai transaksi/anggaran yang bisa dihapus."
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
        isDanger
      />
    </div>
  );
}
