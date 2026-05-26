import { useState, useEffect } from 'react';
import api from '../services/api';
import { KeyRound, Plus, Trash2, Download, Eye, EyeOff, Globe, Gamepad2, Smartphone, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';

export default function Accounts() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [showAccModal, setShowAccModal] = useState(false);
  const [editingAccId, setEditingAccId] = useState(null);
  const [accForm, setAccForm] = useState({ name: '', type: 'Website', login_via: '', password: '' });
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  const types = ['Website', 'Game', 'APK'];

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounts');
      setAccounts(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const resetAccForm = () => {
    setEditingAccId(null);
    setAccForm({ name: '', type: 'Website', login_via: '', password: '' });
  };

  const openAddAccModal = () => {
    resetAccForm();
    setShowAccModal(true);
  };

  const openEditAccModal = (acc) => {
    setEditingAccId(acc.id);
    setAccForm({ name: acc.name, type: acc.type, login_via: acc.login_via, password: '' });
    setShowAccModal(true);
  };

  const closeAccModal = () => {
    setShowAccModal(false);
    resetAccForm();
  };

  const handleSaveAcc = async (e) => {
    e.preventDefault();
    try {
      if (editingAccId) {
        const payload = { name: accForm.name, type: accForm.type, login_via: accForm.login_via };
        if (accForm.password) payload.password = accForm.password;
        await api.put(`/accounts/${editingAccId}`, payload);
        showToast(`Akun "${accForm.name}" berhasil diperbarui.`, 'success');
      } else {
        await api.post('/accounts', accForm);
        showToast(`Akun "${accForm.name}" berhasil disimpan.`, 'success');
      }
      closeAccModal();
      fetchAccounts();
    } catch (e) {
      showToast(e.response?.data?.error || (editingAccId ? 'Gagal memperbarui akun.' : 'Gagal menyimpan akun.'), 'error');
    }
  };

  const requestDelete = (id) => {
    setConfirmData({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/accounts/${confirmData.id}`);
      fetchAccounts();
      showToast('Akun berhasil dihapus.', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menghapus akun.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const exportToExcel = () => {
    const wsData = accounts.map(a => ({
      'Tipe': a.type,
      'Nama Layanan': a.name,
      'Login Via': a.login_via,
      'Password (Decrypted)': a.password,
      'Dibuat Pada': new Date(a.created_at).toLocaleDateString('id-ID')
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Akun Tersimpan");
    XLSX.writeFile(wb, "Data_Akun_Pribadi.xlsx");
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'Website': return <Globe size={20} color="var(--primary)" />;
      case 'Game': return <Gamepad2 size={20} color="var(--success)" />;
      case 'APK': return <Smartphone size={20} color="#f59e0b" />;
      default: return <KeyRound size={20} />;
    }
  };

  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, curr) => {
    if (!acc[curr.type]) acc[curr.type] = [];
    acc[curr.type].push(curr);
    return acc;
  }, {});

  return (
    <div className="glass-panel page-container fade-in" style={{ minHeight: 'calc(100vh - 150px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Manajemen Akun</h2>
          <p>Catat dan simpan detail login akun Anda secara aman.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={exportToExcel} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <Download size={18} /> Ekspor Excel
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddAccModal}>
            <Plus size={18} /> Tambah Akun
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
        {types.map(type => {
          if (!groupedAccounts[type] || groupedAccounts[type].length === 0) return null;
          return (
            <div key={type}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                {getIconForType(type)} Kategori {type}
              </h3>
              <div className="dashboard-grid">
                {groupedAccounts[type].map(acc => (
                  <div
                    key={acc.id}
                    className="glass-panel clickable-row"
                    style={{ background: 'rgba(15, 23, 42, 0.4)', position: 'relative', cursor: 'pointer' }}
                    onClick={() => openEditAccModal(acc)}
                    title="Klik untuk edit"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>{acc.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Login via: <span style={{ color: 'var(--primary)' }}>{acc.login_via}</span></div>
                      </div>
                      <div className="action-btns" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openEditAccModal(acc)} className="btn-icon-edit" title="Edit"><Pencil size={16} /></button>
                        <button type="button" onClick={() => requestDelete(acc.id)} style={{ background: 'transparent', color: 'var(--danger)', padding: '0.25rem' }} title="Hapus"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '1.2rem', letterSpacing: visiblePasswords[acc.id] ? 'normal' : '3px', fontFamily: visiblePasswords[acc.id] ? 'inherit' : 'monospace', color: 'var(--text-main)' }}>
                        {visiblePasswords[acc.id] ? acc.password : '••••••••'}
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(acc.id); }} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.25rem' }}>
                        {visiblePasswords[acc.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {accounts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            <KeyRound size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Anda belum menyimpan akun apapun.</p>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAccModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingAccId ? 'Edit Catatan Akun' : 'Tambah Catatan Akun'}</h2>
            <form onSubmit={handleSaveAcc}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nama (Cth: Mobile Legends, Facebook)</label>
                <input type="text" className="input-field" value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tipe Platform</label>
                <select className="input-field" value={accForm.type} onChange={e => setAccForm({ ...accForm, type: e.target.value })}>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Login Via (Email / Username / No. HP)</label>
                <input type="text" className="input-field" value={accForm.login_via} onChange={e => setAccForm({ ...accForm, login_via: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Password{editingAccId ? ' (kosongkan jika tidak diubah)' : ''}</label>
                <input type="password" className="input-field" value={accForm.password} onChange={e => setAccForm({ ...accForm, password: e.target.value })} required={!editingAccId} placeholder={editingAccId ? 'Biarkan kosong jika sama' : ''} />
                <small style={{ color: 'var(--success)', display: 'block', marginTop: '0.5rem' }}>*Password akan dienkripsi dengan aman di database.</small>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeAccModal} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                <button type="submit" className="btn-primary">{editingAccId ? 'Perbarui' : 'Simpan Akun'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      <CustomConfirm
        isOpen={confirmData.isOpen}
        title="Hapus Akun"
        message="Apakah Anda yakin ingin menghapus catatan akun ini? Data yang dihapus tidak dapat dikembalikan."
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
      />
    </div>
  );
}
