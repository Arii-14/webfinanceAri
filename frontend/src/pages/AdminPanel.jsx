import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../App';
import api from '../services/api';
import { cachedFetch, makeCacheKey, invalidateCacheByPrefix } from '../services/clientCache';
import {
  ShieldAlert, Trash2, ArrowLeft, UserPlus,
  TrendingUp, TrendingDown, Activity, Users, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';
import { getInitials } from '../utils/userDisplay';
import SiteFooter from '../components/SiteFooter';

export default function AdminPanel() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // ── State daftar user (dengan pagination) ────────────────────────────────
  const [users, setUsers]           = useState([]);
  const [userTotal, setUserTotal]   = useState(0);
  const [userPage, setUserPage]     = useState(1);
  const [userLoading, setUserLoading] = useState(false);
  const USER_LIMIT = 10;

  // ── State statistik sistem ────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── State tambah user ─────────────────────────────────────────────────────
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser]         = useState({ username: '', email: '', password: '' });
  const [addLoading, setAddLoading]   = useState(false);

  // ── Confirm hapus user ────────────────────────────────────────────────────
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null });

  // ── Rate limit banner ─────────────────────────────────────────────────────
  const [rateLimitMsg, setRateLimitMsg]       = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // Guard — admin only
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/'); return; }
    fetchStats();
    fetchUsers(1);
  }, [user, navigate]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Rate limit listener
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handler = (e) => {
      setRateLimitMsg(e.detail.message);
      const retryAfter = e.detail.retryAfter;
      const tick = () => {
        const sisa = Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
        setRateLimitCountdown(sisa);
        if (sisa > 0) setTimeout(tick, 1000);
        else setRateLimitMsg('');
      };
      tick();
    };
    window.addEventListener('rateLimited', handler);
    return () => window.removeEventListener('rateLimited', handler);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Fetch statistik (cache 60 detik)
  // ═══════════════════════════════════════════════════════════════════════════
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const key = makeCacheKey('/admin/stats');
      const data = await cachedFetch(
        () => api.get('/admin/stats').then(r => r.data),
        key,
        60
      );
      setStats(data);
    } catch (e) {
      console.error('Gagal memuat statistik:', e);
    } finally {
      setStatsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Fetch daftar user — server-side pagination (cache 30 detik)
  // ═══════════════════════════════════════════════════════════════════════════
  const fetchUsers = useCallback(async (page = 1) => {
    setUserLoading(true);
    try {
      const key = makeCacheKey('/users', { page, limit: USER_LIMIT });
      const data = await cachedFetch(
        () => api.get('/users', { params: { page, limit: USER_LIMIT } }).then(r => r.data),
        key,
        30
      );
      setUsers(data.users || []);
      setUserTotal(data.total || 0);
      setUserPage(page);
    } catch (e) {
      console.error('Gagal memuat pengguna:', e);
    } finally {
      setUserLoading(false);
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(userTotal / USER_LIMIT));

  // ═══════════════════════════════════════════════════════════════════════════
  // Hapus user
  // ═══════════════════════════════════════════════════════════════════════════
  const requestDeleteUser = (id) => setConfirmData({ isOpen: true, id });

  const executeDeleteUser = async () => {
    try {
      await api.delete(`/users/${confirmData.id}`);
      invalidateCacheByPrefix('/users');
      invalidateCacheByPrefix('/admin/stats');
      showToast('Pengguna berhasil dihapus.', 'success');
      // Kembali ke halaman sebelumnya jika halaman sekarang jadi kosong
      const newTotal = userTotal - 1;
      const newPage  = Math.min(userPage, Math.max(1, Math.ceil(newTotal / USER_LIMIT)));
      fetchUsers(newPage);
      fetchStats();
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menghapus pengguna.', 'error');
    } finally {
      setConfirmData({ isOpen: false, id: null });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Tambah user
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await api.post('/users', newUser);
      invalidateCacheByPrefix('/users');
      invalidateCacheByPrefix('/admin/stats');
      setShowAddUser(false);
      setNewUser({ username: '', email: '', password: '' });
      fetchUsers(userPage);
      fetchStats();
      showToast('Pengguna berhasil ditambahkan.', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Gagal menambahkan pengguna.', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Helper format rupiah
  // ═══════════════════════════════════════════════════════════════════════════
  const fmtRp = (n) =>
    'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="admin-page-wrap" id="top">
    <div className="admin-page-body fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'transparent', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={20} /> Kembali ke Dashboard
          </button>
          <h1>
            <ShieldAlert size={28} style={{ color: 'var(--danger)', verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Panel Admin
          </h1>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowAddUser(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <UserPlus size={18} /> Tambah Pengguna
        </button>
      </div>

      {/* ── Banner Rate Limit ───────────────────────────────────────────────── */}
      {rateLimitMsg && (
        <div style={{
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: '0.75rem',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 500
        }}>
          <Activity size={20} style={{ flexShrink: 0 }} />
          <span>
            {rateLimitMsg}
            {rateLimitCountdown > 0 && (
              <> &mdash; Sisa waktu: <strong>
                {Math.floor(rateLimitCountdown / 60).toString().padStart(2, '0')}:{(rateLimitCountdown % 60).toString().padStart(2, '0')}
              </strong></>
            )}
          </span>
        </div>
      )}

      {/* ── Kartu Statistik ────────────────────────────────────────────────── */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        {/* Total Pengguna */}
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Users size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>Total Pengguna</h3>
          </div>
          <div className="amount">
            {statsLoading ? '…' : (stats?.total_users ?? users.length)}
          </div>
        </div>

        {/* Total Transaksi */}
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>Total Transaksi</h3>
          </div>
          <div className="amount">
            {statsLoading ? '…' : (stats?.total_transactions ?? 0).toLocaleString('id-ID')}
          </div>
        </div>

        {/* Total Pemasukan */}
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--success)' }} />
            <h3 style={{ margin: 0 }}>Total Pemasukan</h3>
          </div>
          <div className="amount income" style={{ fontSize: '1.1rem' }}>
            {statsLoading ? '…' : fmtRp(stats?.total_income)}
          </div>
        </div>

        {/* Total Pengeluaran */}
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingDown size={18} style={{ color: 'var(--danger)' }} />
            <h3 style={{ margin: 0 }}>Total Pengeluaran</h3>
          </div>
          <div className="amount expense" style={{ fontSize: '1.1rem' }}>
            {statsLoading ? '…' : fmtRp(stats?.total_expense)}
          </div>
        </div>
      </div>

      {/* ── Daftar Pengguna ─────────────────────────────────────────────────── */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>
            Semua Pengguna
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.75rem' }}>
              ({userTotal} total)
            </span>
          </h3>
          {/* Navigasi halaman */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => fetchUsers(userPage - 1)}
              disabled={userPage <= 1 || userLoading}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.5rem',
                color: userPage <= 1 ? 'var(--text-muted)' : 'var(--text-main)',
                padding: '0.4rem 0.75rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                cursor: userPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: userPage <= 1 ? 0.4 : 1,
                transition: 'all 0.2s'
              }}
            >
              <ChevronLeft size={16} /> Sebelumnya
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: '6rem', textAlign: 'center' }}>
              Hal {userPage} / {totalPages}
            </span>
            <button
              onClick={() => fetchUsers(userPage + 1)}
              disabled={userPage >= totalPages || userLoading}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.5rem',
                color: userPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                padding: '0.4rem 0.75rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                cursor: userPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: userPage >= totalPages ? 0.4 : 1,
                transition: 'all 0.2s'
              }}
            >
              Selanjutnya <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Avatar</th>
                <th style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Username</th>
                <th style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email</th>
                <th style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Peran</th>
                <th style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Bergabung</th>
                <th style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {userLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Memuat…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Tidak ada pengguna.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.75rem 0' }}>
                      {/* Selalu tampilkan inisial — tidak load profile_image di list */}
                      <div className="admin-user-avatar">
                        {getInitials(u.username)}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{u.username}</td>
                    <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem 0' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: u.role === 'admin' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                        color: u.role === 'admin' ? 'var(--danger)' : 'var(--primary)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        letterSpacing: '0.03em'
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 0' }}>
                      {u.id !== user.id && u.role !== 'admin' ? (
                        <button
                          onClick={() => requestDeleteUser(u.id)}
                          style={{ background: 'transparent', color: 'var(--danger)', padding: '0.25rem' }}
                          title="Hapus pengguna"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Tambah User ───────────────────────────────────────────────── */}
      {showAddUser && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Tambah Pengguna Baru</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Hanya dapat menambah akun dengan peran <strong>User</strong>. Admin tetap satu: muhammadariusni@gmail.com
            </p>
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Nama Pengguna
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Email
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Kata Sandi
                </label>
                <input
                  type="password"
                  className="input-field"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddUser(false); setNewUser({ username: '', email: '', password: '' }); }}
                  style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}
                  disabled={addLoading}
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={addLoading}>
                  {addLoading ? 'Menambahkan…' : 'Tambah User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Hapus User ──────────────────────────────────────────────── */}
      <CustomConfirm
        isOpen={confirmData.isOpen}
        title="Hapus Pengguna"
        message="Apakah Anda yakin ingin menghapus pengguna ini beserta seluruh datanya?"
        onConfirm={executeDeleteUser}
        onCancel={() => setConfirmData({ isOpen: false, id: null })}
      />
    </div>
    <SiteFooter mode="public" />
    </div>
  );
}
