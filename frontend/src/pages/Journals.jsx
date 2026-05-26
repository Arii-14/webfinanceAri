import { useState, useEffect } from 'react';
import api from '../services/api';
import { BookHeart, Plus, Trash2, Smile, Frown, Meh, Download, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';

export default function Journals() {
  const { showToast } = useToast();
  const [journals, setJournals] = useState([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState(null);
  const [journalForm, setJournalForm] = useState({ mood: 'biasa', content: '', date: new Date().toISOString().split('T')[0] });
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = async () => {
    try {
      const res = await api.get('/journals');
      setJournals(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const resetJournalForm = () => {
    setEditingJournalId(null);
    setJournalForm({ mood: 'biasa', content: '', date: new Date().toISOString().split('T')[0] });
  };

  const openAddJournalModal = () => {
    resetJournalForm();
    setShowJournalModal(true);
  };

  const openEditJournalModal = (journal) => {
    const dateStr = typeof journal.date === 'string' ? journal.date.split('T')[0] : journal.date;
    setEditingJournalId(journal.id);
    setJournalForm({ mood: journal.mood, content: journal.content, date: dateStr });
    setShowJournalModal(true);
  };

  const closeJournalModal = () => {
    setShowJournalModal(false);
    resetJournalForm();
  };

  const handleSaveJournal = async (e) => {
    e.preventDefault();
    try {
      if (editingJournalId) {
        await api.put(`/journals/${editingJournalId}`, journalForm);
        showToast('Catatan jurnal berhasil diperbarui.', 'success');
      } else {
        await api.post('/journals', journalForm);
        showToast('Catatan jurnal berhasil disimpan.', 'success');
      }
      closeJournalModal();
      fetchJournals();
    } catch (e) {
      showToast(e.response?.data?.error || (editingJournalId ? 'Gagal memperbarui catatan.' : 'Gagal menyimpan catatan.'), 'error');
    }
  };

  const requestDelete = (id) => {
    setConfirmData({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/journals/${confirmData.id}`);
      fetchJournals();
      showToast('Catatan jurnal berhasil dihapus.', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menghapus catatan.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  const exportToExcel = () => {
    const wsData = journals.map(j => ({
      'Tanggal': new Date(j.date).toLocaleDateString('id-ID'),
      'Mood': j.mood.toUpperCase(),
      'Catatan': j.content,
      'Dibuat Pada': new Date(j.created_at).toLocaleDateString('id-ID')
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catatan Jurnal");
    XLSX.writeFile(wb, "Data_Catatan_Pribadi.xlsx");
  };

  const getMoodIcon = (mood) => {
    switch(mood) {
      case 'senang': return <Smile size={24} color="var(--success)" />;
      case 'sedih': return <Frown size={24} color="var(--danger)" />;
      default: return <Meh size={24} color="#f59e0b" />;
    }
  };

  return (
    <div className="glass-panel page-container fade-in" style={{ minHeight: 'calc(100vh - 150px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Catatan Pribadi (Jurnal)</h2>
          <p>Tulis apa yang Anda rasakan hari ini.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={exportToExcel} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <Download size={18} /> Ekspor Excel
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddJournalModal}>
            <Plus size={18} /> Tulis Catatan
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {journals.map(journal => (
          <div
            key={journal.id}
            className="glass-panel clickable-row"
            style={{ background: 'rgba(15, 23, 42, 0.4)', position: 'relative', cursor: 'pointer' }}
            onClick={() => openEditJournalModal(journal)}
            title="Klik untuk edit"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  {getMoodIcon(journal.mood)}
                  <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>{journal.mood}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    {new Date(journal.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <p style={{ lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{journal.content}</p>
                </div>
              </div>
              <div className="action-btns" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => openEditJournalModal(journal)} className="btn-icon-edit" title="Edit"><Pencil size={16} /></button>
                <button type="button" onClick={() => requestDelete(journal.id)} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem' }} title="Hapus"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        
        {journals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            <BookHeart size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Belum ada catatan pribadi. Mulai menulis catatan Anda!</p>
          </div>
        )}
      </div>

      {/* Tambah Jurnal Modal */}
      {showJournalModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>{editingJournalId ? 'Edit Catatan' : 'Tulis Catatan Baru'}</h2>
            <form onSubmit={handleSaveJournal}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Bagaimana perasaan Anda?</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {['senang', 'biasa', 'sedih'].map(mood => (
                    <label key={mood} style={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '1rem', 
                      background: journalForm.mood === mood ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)', 
                      border: journalForm.mood === mood ? '1px solid var(--primary)' : '1px solid transparent',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input 
                        type="radio" 
                        name="mood" 
                        value={mood} 
                        checked={journalForm.mood === mood} 
                        onChange={() => setJournalForm({ ...journalForm, mood })} 
                        style={{ display: 'none' }} 
                      />
                      {getMoodIcon(mood)}
                      <span style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>{mood}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tanggal</label>
                <input type="date" className="input-field" value={journalForm.date} onChange={e => setJournalForm({ ...journalForm, date: e.target.value })} required />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ceritakan pengalaman Anda</label>
                <textarea 
                  className="input-field" 
                  value={journalForm.content} 
                  onChange={e => setJournalForm({ ...journalForm, content: e.target.value })} 
                  placeholder="Hari ini saya merasa..." 
                  rows="4"
                  required 
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeJournalModal} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                <button type="submit" className="btn-primary">{editingJournalId ? 'Perbarui' : 'Simpan Catatan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomConfirm 
        isOpen={confirmData.isOpen}
        title="Hapus Catatan Pribadi"
        message="Apakah Anda yakin ingin menghapus catatan jurnal ini? Data yang dihapus tidak dapat dikembalikan."
        onConfirm={executeDelete}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
      />
    </div>
  );
}
