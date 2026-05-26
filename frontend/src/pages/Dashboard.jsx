import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../App';
import api from '../services/api';
import { LayoutDashboard, ReceiptText, Users, LogOut, Plus, Trash2, Settings, Target, Wallet, CalendarClock, Download, AlertTriangle, BookHeart, KeyRound, Menu, X, Camera, Pencil, Landmark, Tags, HandCoins, HelpCircle } from 'lucide-react';
import FAQModal from '../components/FAQModal';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

import Savings from './Savings';
import Budgets from './Budgets';
import Subscriptions from './Subscriptions';
import Journals from './Journals';
import Accounts from './Accounts';
import Wallets from './Wallets';
import Categories from './Categories';
import Debts from './Debts';
import AlertSettings from '../components/AlertSettings';
import SiteFooter from '../components/SiteFooter';
import { fetchCategories, categoryNames, colorForCategory } from '../hooks/useCategories';
import CustomConfirm from '../components/CustomConfirm';
import { useToast } from '../context/ToastContext';
import { getTimeGreeting, getInitials, getDashboardSubtitle } from '../utils/userDisplay';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

export default function Dashboard() {
  const { user, setUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [journals, setJournals] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [wallets, setWallets] = useState([]);
  const walletsLoadedRef = useRef(false);
  const [newTx, setNewTx] = useState({ type: 'expense', amount: '', category: 'Makanan', date: new Date().toISOString().split('T')[0], note: '', wallet_id: '' });
  const [profileData, setProfileData] = useState({ username: user?.username || '', email: user?.email || '', newPassword: '' });
  const [budgetWarning, setBudgetWarning] = useState('');
  const [confirmData, setConfirmData] = useState({ isOpen: false, id: null, type: '' });

  // Mobile menu & profile avatar cropping states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropPos, setCropPos] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastBudgetToastRef = useRef('');

  const [userCategories, setUserCategories] = useState([]);
  const currentMonth = new Date().toISOString().substring(0, 7);
  const categories = categoryNames(userCategories).length > 0
    ? categoryNames(userCategories)
    : ['Makanan', 'Transportasi', 'Hiburan', 'Tagihan', 'Gaji', 'Lainnya'];

  // File selection and crop handlers
  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const MAX_IMAGE_SIZE_MB = 8;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
      showToast(`Ukuran file gambar terlalu besar (${fileSizeMB.toFixed(2)} MB). Maksimal ${MAX_IMAGE_SIZE_MB} MB.`, 'error', 5000);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setZoom(1);
      setCropPos({ x: 40, y: 40 }); // Start with centered offset
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Drag to pan image crop modal handlers (Mouse)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setCropPos({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Drag to pan image crop modal handlers (Touch)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - cropPos.x, y: touch.clientY - cropPos.y });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setCropPos({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Save crop on canvas, compress, resize to 160x160 px JPEG (quality 0.7), base64
  const handleCropSave = () => {
    if (!cropImageSrc) return;

    const img = new Image();
    img.src = cropImageSrc;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');

      // Coordinate transformation:
      // The viewport is 280x280. Circle crop guide is 200x200 centered at (40, 40) offset.
      // Offset relative to crop guide is (cropPos.x - 40, cropPos.y - 40).
      // Scale ratio from guide (200px) to Canvas output (160px) is 160/200 = 0.8.
      const scaleRatio = 160 / 200;
      const dx = (cropPos.x - 40) * scaleRatio;
      const dy = (cropPos.y - 40) * scaleRatio;
      const dw = (280 * zoom) * scaleRatio;
      const dh = (280 * (img.naturalHeight / img.naturalWidth) * zoom) * scaleRatio;

      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, 160, 160);
      ctx.drawImage(img, dx, dy, dw, dh);

      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

      try {
        await api.post('/users/profile-image', { image: compressedBase64 });
        setUser({ ...user, profile_image: compressedBase64 });
        setShowCropModal(false);
        setCropImageSrc(null);
        showToast('Foto profil berhasil diperbarui.', 'success');
      } catch (err) {
        showToast('Gagal mengunggah foto profil: ' + (err.response?.data?.error || err.message), 'error');
      }
    };
  };

  useEffect(() => {
    fetchTransactions();
    fetchBudgets();
    fetchJournals();
    fetchCategories().then(setUserCategories).catch(console.error);
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/transactions');
      setTransactions(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBudgets = async () => {
    try {
      const res = await api.get('/budgets');
      setBudgets(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJournals = async () => {
    try {
      const res = await api.get('/journals');
      setJournals(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Smart Budget Logic on form change
  useEffect(() => {
    if (newTx.type === 'expense' && newTx.amount) {
      const amount = parseFloat(newTx.amount);
      const categoryBudget = budgets.find(b => b.category === newTx.category && b.month === currentMonth);
      if (categoryBudget) {
        // Calculate current spent in this category this month
        const currentSpent = transactions
          .filter(t => t.type === 'expense' && t.category === newTx.category && t.date.startsWith(currentMonth))
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        if (currentSpent + amount > parseFloat(categoryBudget.limit_amount)) {
          setBudgetWarning(`Peringatan: Ini akan melebihi batas pengeluaran bulan ini untuk ${newTx.category} (Batas: Rp ${parseFloat(categoryBudget.limit_amount).toLocaleString('id-ID')})`);
        } else if (currentSpent + amount > parseFloat(categoryBudget.limit_amount) * 0.8) {
          setBudgetWarning(`Perhatian: Anda hampir mencapai batas pengeluaran untuk ${newTx.category}.`);
        } else {
          setBudgetWarning('');
        }
      } else {
        setBudgetWarning('');
      }
    } else {
      setBudgetWarning('');
    }
  }, [newTx.amount, newTx.category, newTx.type, budgets, transactions, currentMonth]);

  // Peringatan anggaran muncul di permukaan atas (toast), bukan di bawah form
  useEffect(() => {
    if (!showAddModal) {
      lastBudgetToastRef.current = '';
      return;
    }
    if (budgetWarning && budgetWarning !== lastBudgetToastRef.current) {
      lastBudgetToastRef.current = budgetWarning;
      showToast(budgetWarning, 'warning', 5500);
    } else if (!budgetWarning) {
      lastBudgetToastRef.current = '';
    }
  }, [budgetWarning, showAddModal, showToast]);

  const loadWalletsForTx = async () => {
    if (walletsLoadedRef.current) return;
    try {
      const res = await api.get('/wallets');
      setWallets(res.data);
      walletsLoadedRef.current = true;
    } catch (e) {
      console.error(e);
    }
  };

  const defaultWalletId = () => {
    const d = wallets.find((w) => w.is_default) || wallets[0];
    return d ? String(d.id) : '';
  };

  const resetTxForm = () => {
    setEditingTxId(null);
    setNewTx({
      type: 'expense',
      amount: '',
      category: 'Makanan',
      date: new Date().toISOString().split('T')[0],
      note: '',
      wallet_id: defaultWalletId(),
    });
    setBudgetWarning('');
    lastBudgetToastRef.current = '';
  };

  const openAddTxModal = async () => {
    let list = wallets;
    if (!walletsLoadedRef.current) {
      try {
        const res = await api.get('/wallets');
        list = res.data;
        setWallets(list);
        walletsLoadedRef.current = true;
      } catch (e) {
        console.error(e);
      }
    }
    const d = list.find((w) => w.is_default) || list[0];
    setEditingTxId(null);
    setNewTx({
      type: 'expense',
      amount: '',
      category: 'Makanan',
      date: new Date().toISOString().split('T')[0],
      note: '',
      wallet_id: d ? String(d.id) : '',
    });
    setBudgetWarning('');
    setShowAddModal(true);
  };

  const openEditTxModal = async (t) => {
    await loadWalletsForTx();
    const dateStr = typeof t.date === 'string' ? t.date.split('T')[0] : t.date;
    setEditingTxId(t.id);
    setNewTx({
      type: t.type,
      amount: String(t.amount),
      category: t.category,
      date: dateStr,
      note: t.note || '',
      wallet_id: t.wallet_id ? String(t.wallet_id) : '',
    });
    setShowAddModal(true);
  };

  const closeTxModal = () => {
    setShowAddModal(false);
    resetTxForm();
  };

  const handleSaveTx = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newTx,
        wallet_id: newTx.wallet_id ? Number(newTx.wallet_id) : null,
      };
      if (editingTxId) {
        await api.put(`/transactions/${editingTxId}`, payload);
        showToast('Transaksi berhasil diperbarui.', 'success');
      } else {
        await api.post('/transactions', payload);
        const label = newTx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const nominal = parseFloat(newTx.amount).toLocaleString('id-ID');
        showToast(`${label} Rp ${nominal} (${newTx.category}) berhasil dicatat.`, 'success');
      }
      closeTxModal();
      fetchTransactions();
    } catch (e) {
      showToast(e.response?.data?.error || (editingTxId ? 'Gagal memperbarui transaksi.' : 'Gagal menyimpan transaksi.'), 'error');
    }
  };

  const requestDeleteTx = (id) => {
    setConfirmData({ isOpen: true, id, type: 'transaction' });
  };

  const requestDeleteAll = () => {
    setConfirmData({ isOpen: true, id: null, type: 'all_data' });
  };

  const executeConfirmAction = async () => {
    if (confirmData.type === 'transaction') {
      try {
        await api.delete(`/transactions/${confirmData.id}`);
        fetchTransactions();
        showToast('Transaksi berhasil dihapus.', 'success');
      } catch (e) {
        showToast(e.response?.data?.error || 'Gagal menghapus transaksi.', 'error');
      } finally {
        setConfirmData({ isOpen: false, id: null, type: '' });
      }
    } else if (confirmData.type === 'all_data') {
      try {
        await api.delete('/users/delete-all-data');
        showToast('Semua data berhasil dihapus.', 'success');
        window.location.reload();
      } catch (e) {
        showToast(e.response?.data?.error || 'Gagal menghapus data.', 'error');
      } finally {
        setConfirmData({ isOpen: false, id: null, type: '' });
      }
    }
  };

  const exportToExcel = () => {
    const wsData = transactions.map(t => ({
      Tanggal: new Date(t.date).toLocaleDateString('id-ID'),
      Tipe: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      Kategori: t.category,
      Nominal: parseFloat(t.amount),
      Catatan: t.note
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, "Laporan_Transaksi.xlsx");
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put('/users/profile', { username: profileData.username, email: profileData.email });
      if (profileData.newPassword) {
        if (user.role === 'admin') {
          await api.put('/users/password', { newPassword: profileData.newPassword });
          showToast('Profil dan kata sandi berhasil diperbarui.', 'success');
        }
      } else {
        showToast('Profil berhasil diperbarui.', 'success');
      }
      setShowProfileModal(false);
      setUser({ ...user, username: profileData.username, email: profileData.email });
      setProfileData({ ...profileData, newPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal memperbarui profil', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Calculations
  const currentMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const income = currentMonthTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  const expense = currentMonthTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  const totalBalance = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + parseFloat(curr.amount), 0) - transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  let healthScore = 0;
  if (income > 0) {
    const savingsRatio = ((income - expense) / income) * 100;
    healthScore = Math.max(0, Math.min(100, 50 + (savingsRatio * 1.5)));
  } else if (expense > 0) {
    healthScore = 10;
  } else {
    healthScore = 50;
  }

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysPassed = today.getDate();
  const dailyAvgExpense = daysPassed > 0 ? expense / daysPassed : 0;
  const daysRemaining = daysInMonth - daysPassed;
  const predictedRemainingExpenses = dailyAvgExpense * daysRemaining;
  const predictiveBalance = totalBalance - predictedRemainingExpenses;

  const expensesByCategory = currentMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  const chartLabels = Object.keys(expensesByCategory).filter((c) => expensesByCategory[c] > 0);
  const hexToRgba = (hex, a = 0.85) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const doughnutData = {
    labels: chartLabels,
    datasets: [{
      data: chartLabels.map((c) => expensesByCategory[c]),
      backgroundColor: chartLabels.map((c) => hexToRgba(colorForCategory(userCategories, c))),
      borderColor: '#05070f',
      borderWidth: 2,
      hoverOffset: 6
    }]
  };

  const doughnutOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#8295b4',
          font: { family: 'Inter', size: 11, weight: '500' },
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: '#0d111e',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        titleColor: '#f8fafc',
        titleFont: { family: 'Inter', weight: 'bold' },
        bodyColor: '#f8fafc',
        bodyFont: { family: 'Inter' },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += 'Rp ' + context.parsed.toLocaleString('id-ID');
            }
            return label;
          }
        }
      }
    },
    cutout: '78%',
    maintainAspectRatio: false,
    responsive: true
  };

  // Journal Chart Data
  const currentMonthJournals = journals.filter(j => j.date.startsWith(currentMonth));
  const moodCounts = {
    senang: currentMonthJournals.filter(j => j.mood === 'senang').length,
    biasa: currentMonthJournals.filter(j => j.mood === 'biasa').length,
    sedih: currentMonthJournals.filter(j => j.mood === 'sedih').length,
  };

  const barData = {
    labels: ['Senang', 'Biasa', 'Sedih'],
    datasets: [
      {
        label: 'Frekuensi Mood',
        data: [moodCounts.senang, moodCounts.biasa, moodCounts.sedih],
        backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderRadius: 4,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: 'var(--text-muted)' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      x: {
        ticks: { color: 'var(--text-muted)' },
        grid: { display: false }
      }
    }
  };

  const handleFooterNav = (tab) => {
    if (tab === 'profile') {
      setShowProfileModal(true);
    } else {
      setActiveTab(tab);
    }
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container fade-in" id="top">
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <button type="button" className="mobile-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Buka menu">
          <Menu size={24} />
        </button>
        <div className="mobile-brand">TendouAriisu</div>
      </div>

      {/* Mobile Sidebar Backdrop */}
      <div className={`mobile-backdrop ${mobileMenuOpen ? 'mobile-open' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>

      {/* Sidebar Navigation */}
      <div className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Tutup menu"
        >
          <X size={22} />
        </button>
        {/* Profile Header */}
        <div className="sidebar-profile">
          <div className="sidebar-avatar-container" onClick={handleAvatarClick} title="Ubah Foto Profil">
            <div className="sidebar-avatar-inner">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="Profile" />
              ) : (
                getInitials(user?.username)
              )}
              <div className="avatar-upload-overlay">
                <Camera size={20} />
              </div>
            </div>
          </div>
          <div className="sidebar-profile-username">{user?.username}</div>
          <div className="sidebar-profile-email">{user?.email}</div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
        
        {/* Nav Links */}
        <div className="nav-links">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <LayoutDashboard size={20} /> Ringkasan
          </div>
          <div className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <ReceiptText size={20} /> Transaksi
          </div>
          <div className={`nav-item ${activeTab === 'wallets' ? 'active' : ''}`} onClick={() => { setActiveTab('wallets'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <Landmark size={20} /> Dompet
          </div>
          <div className={`nav-item ${activeTab === 'debts' ? 'active' : ''}`} onClick={() => { setActiveTab('debts'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <HandCoins size={20} /> Utang & Piutang
          </div>
          <div className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => { setActiveTab('categories'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <Tags size={20} /> Kategori
          </div>
          <div className={`nav-item ${activeTab === 'budgets' ? 'active' : ''}`} onClick={() => { setActiveTab('budgets'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <Wallet size={20} /> Anggaran
          </div>
          <div className={`nav-item ${activeTab === 'savings' ? 'active' : ''}`} onClick={() => { setActiveTab('savings'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <Target size={20} /> Target Tabungan
          </div>
          <div className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => { setActiveTab('subscriptions'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <CalendarClock size={20} /> Langganan
          </div>
          <div className={`nav-item ${activeTab === 'journals' ? 'active' : ''}`} onClick={() => { setActiveTab('journals'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <BookHeart size={20} /> Catatan Pribadi
          </div>
          <div className={`nav-item ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => { setActiveTab('accounts'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <KeyRound size={20} /> Manajemen Akun
          </div>

          <div style={{ margin: '1rem 0', borderTop: '1px solid var(--border)' }}></div>

          <div className="nav-item" onClick={() => { setShowProfileModal(true); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <Settings size={20} /> Pengaturan Profil
          </div>
          {user?.role === 'admin' && (
            <div className="nav-item" onClick={() => { window.location.href = '/admin'; setMobileMenuOpen(false); }} style={{cursor: 'pointer', color: 'var(--success)'}}>
              <Users size={20} /> Panel Admin
            </div>
          )}
        </div>

        {/* Sidebar Footer with Danger/Logout controls */}
        <div className="sidebar-footer">
          <div className="nav-item" onClick={() => { requestDeleteAll(); setMobileMenuOpen(false); }} style={{cursor: 'pointer', color: 'var(--danger)', marginBottom: '0.25rem'}}>
            <AlertTriangle size={20} /> Hapus Semua Data
          </div>
          <div className="nav-item" onClick={handleLogout} style={{cursor: 'pointer', color: 'var(--text-muted)'}}>
            <LogOut size={20} /> Keluar
          </div>
        </div>
      </div>

      <div className="app-main-column">
      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <div className="header-title-row">
            <h1>
              {activeTab === 'dashboard'
                ? getTimeGreeting()
                : activeTab === 'transactions'
                  ? 'Transaksi'
                  : activeTab === 'wallets'
                    ? 'Dompet Keuangan'
                    : activeTab === 'debts'
                        ? 'Utang & Piutang'
                        : activeTab === 'categories'
                          ? 'Kategori Kustom'
                          : activeTab === 'budgets'
                    ? 'Anggaran'
                    : activeTab === 'savings'
                      ? 'Target Tabungan'
                      : activeTab === 'subscriptions'
                        ? 'Langganan'
                        : activeTab === 'journals'
                          ? 'Catatan Pribadi'
                          : 'Manajemen Akun'}
            </h1>
            {activeTab === 'dashboard' ? (
              <p className="header-greeting-subtitle">{getDashboardSubtitle(user?.username)}</p>
            ) : (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>Selamat datang kembali, {user?.username}</p>
            )}
          </div>
          <div className="header-actions user-profile">
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddTxModal}>
              <Plus size={18} /> Transaksi Baru
            </button>
            <button 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: '1px solid var(--border)', boxShadow: 'none' }}
              onClick={() => setShowFaqModal(true)}
              title="Panduan Penggunaan"
            >
              <HelpCircle size={18} /> <span className="hide-on-mobile" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Panduan</span>
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="dashboard-grid">
              <div className="glass-panel stat-card" style={{ background: 'linear-gradient(135deg, rgba(20, 26, 45, 0.9), rgba(10, 15, 30, 0.9))' }}>
                <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Saldo</span>
                  <span style={{ color: 'var(--success)', fontSize: '0.8rem', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '12px' }}>Aktual</span>
                </h3>
                <div className="amount" style={{ margin: '0.5rem 0' }}>Rp {totalBalance.toLocaleString('id-ID')}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Prediksi akhir bulan: <span style={predictiveBalance < 0 ? {color: 'var(--danger)'} : {color: 'var(--primary)'}}>Rp {predictiveBalance.toLocaleString('id-ID', {maximumFractionDigits: 0})}</span>
                </div>
              </div>
              <div className="glass-panel stat-card stat-income">
                <h3>Pemasukan Bulan Ini</h3>
                <div className="amount income">Rp {income.toLocaleString('id-ID')}</div>
              </div>
              <div className="glass-panel stat-card stat-expense">
                <h3>Pengeluaran Bulan Ini</h3>
                <div className="amount expense">Rp {expense.toLocaleString('id-ID')}</div>
              </div>
            </div>

            {/* Visual Sisa Anggaran (Budget Limit) */}
            {activeTab === 'dashboard' && budgets.filter(b => b.month === currentMonth).length > 0 && (
              <div className="glass-panel" style={{ marginBottom: '2.25rem' }}>
                <h3 style={{ marginBottom: '1.25rem', fontWeight: 600 }}>Status Anggaran Bulan Ini</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {budgets.filter(b => b.month === currentMonth).map(budget => {
                    const limit = parseFloat(budget.limit_amount);
                    const spent = expensesByCategory[budget.category] || 0;
                    const remaining = limit - spent;
                    const percentage = Math.min((spent / limit) * 100, 100);
                    
                    let barColor = 'var(--success)';
                    if (percentage >= 90) barColor = 'var(--danger)';
                    else if (percentage >= 70) barColor = '#f59e0b';
                    
                    return (
                      <div key={budget.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span style={{ fontWeight: 600 }}>{budget.category}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            Terpakai: Rp {spent.toLocaleString('id-ID')} / Batas: Rp {limit.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: barColor, borderRadius: '5px', transition: 'width 0.3s ease, background 0.3s ease' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', color: barColor, fontWeight: 600 }}>
                          {remaining < 0 ? `Melebihi anggaran: Rp ${Math.abs(remaining).toLocaleString('id-ID')}` : `Sisa: Rp ${remaining.toLocaleString('id-ID')}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="charts-section">
              <div className="glass-panel">
                <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Pengeluaran per Kategori (Bulan Ini)</h3>
                <div style={{ height: '300px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                   {currentMonthTx.filter(t => t.type === 'expense').length > 0 ? (
                      <>
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        <div className="chart-center-wrapper">
                           <div className="center-title">Total</div>
                           <div className="center-value" style={{ color: 'var(--danger)', fontSize: '1.25rem', fontWeight: '800' }}>
                             Rp {expense.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                           </div>
                        </div>
                      </>
                   ) : (
                      <p style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>Belum ada pengeluaran bulan ini.</p>
                   )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '1rem', fontWeight: 600, alignSelf: 'flex-start' }}>Skor Kesehatan Keuangan</h3>
                  <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: `conic-gradient(${healthScore > 70 ? 'var(--success)' : healthScore > 40 ? '#f59e0b' : 'var(--danger)'} ${healthScore}%, rgba(255,255,255,0.1) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold' }}>
                      {healthScore.toFixed(0)}
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {healthScore > 70 ? 'Keuangan Anda sangat sehat! Teruslah menabung.' : healthScore > 40 ? 'Keuangan Anda cukup baik, tapi perhatikan pengeluaran.' : 'Peringatan: Pengeluaran sangat tinggi dibanding pemasukan!'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bagian Grafik Jurnal (Sesuai Permintaan User) */}
            <div className="glass-panel" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Statistik Mood Bulan Ini (Catatan Pribadi)</h3>
              <div style={{ height: '200px' }}>
                {currentMonthJournals.length > 0 ? (
                  <Bar data={barData} options={barOptions} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Belum ada catatan jurnal bulan ini.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel transactions-section" style={{ marginTop: '0' }}>
              <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Transaksi Terakhir</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kategori</th>
                      <th>Catatan</th>
                      <th>Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 5).map(t => (
                      <tr key={t.id} className="clickable-row" onClick={() => openEditTxModal(t)} title="Klik untuk edit">
                        <td>{new Date(t.date).toLocaleDateString('id-ID')}</td>
                        <td>{t.category}</td>
                        <td>{t.note}</td>
                        <td className={t.type === 'income' ? 'income' : 'expense'} style={{ fontWeight: 500 }}>
                          {t.type === 'income' ? '+' : '-'} Rp {parseFloat(t.amount).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada transaksi</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <div className="glass-panel fade-in" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 600 }}>Semua Transaksi</h2>
              <button onClick={exportToExcel} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)' }}>
                <Download size={18} /> Ekspor Excel
              </button>
            </div>
            <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--panel-bg)', zIndex: 1 }}>
                  <tr>
                    <th>Tanggal</th>
                    <th>Tipe</th>
                    <th>Kategori</th>
                    <th>Catatan</th>
                    <th>Nominal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} className="clickable-row" onClick={() => openEditTxModal(t)} title="Klik untuk edit">
                      <td>{new Date(t.date).toLocaleDateString('id-ID')}</td>
                      <td>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '0.25rem', 
                          background: t.type === 'income' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                          color: t.type === 'income' ? 'var(--success)' : 'var(--danger)',
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}>{t.type === 'income' ? 'PEMASUKAN' : 'PENGELUARAN'}</span>
                      </td>
                      <td>{t.category}</td>
                      <td>{t.note}</td>
                      <td className={t.type === 'income' ? 'income' : 'expense'}>
                        {t.type === 'income' ? '+' : '-'} Rp {parseFloat(t.amount).toLocaleString('id-ID')}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="action-btns">
                          <button type="button" onClick={() => openEditTxModal(t)} className="btn-icon-edit" title="Edit"><Pencil size={18} /></button>
                          <button type="button" onClick={() => requestDeleteTx(t.id)} style={{ background: 'transparent', color: 'var(--danger)' }} title="Hapus"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada transaksi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'wallets' && <Wallets />}
        {activeTab === 'debts' && <Debts />}
        {activeTab === 'categories' && <Categories />}
        {activeTab === 'savings' && <Savings />}
        {activeTab === 'budgets' && <Budgets />}
        {activeTab === 'subscriptions' && <Subscriptions />}
        {activeTab === 'journals' && <Journals />}
        {activeTab === 'accounts' && <Accounts />}

        {/* Modal Tambah / Edit Transaksi */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content">
              <h2 style={{ marginBottom: '1.5rem' }}>{editingTxId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
              <form onSubmit={handleSaveTx}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <label style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                    <input type="radio" name="type" checked={newTx.type === 'expense'} onChange={() => setNewTx({...newTx, type: 'expense'})} /> Pengeluaran
                  </label>
                  <label style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                    <input type="radio" name="type" checked={newTx.type === 'income'} onChange={() => setNewTx({...newTx, type: 'income'})} /> Pemasukan
                  </label>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nominal (Rp)</label>
                  <input type="number" className="input-field" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} required placeholder="0" />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Kategori</label>
                  <select className="input-field" value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {wallets.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dompet</label>
                    <select className="input-field" value={newTx.wallet_id} onChange={e => setNewTx({...newTx, wallet_id: e.target.value})}>
                      <option value="">— Tanpa dompet —</option>
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tanggal</label>
                  <input type="date" className="input-field" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} required />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Catatan Tambahan</label>
                  <input type="text" className="input-field" value={newTx.note} onChange={e => setNewTx({...newTx, note: e.target.value})} placeholder="Deskripsi..." />
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={closeTxModal} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                  <button type="submit" className="btn-primary">{editingTxId ? 'Perbarui' : 'Simpan'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Edit Profile */}
        {showProfileModal && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content">
              <h2 style={{ marginBottom: '1.5rem' }}>Pengaturan Profil</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="header-avatar" style={{ width: 56, height: 56, minWidth: 56, fontSize: '1rem', cursor: 'pointer' }} onClick={handleAvatarClick} title="Ubah foto profil">
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="Profile" />
                  ) : (
                    getInitials(user?.username)
                  )}
                </div>
                <button type="button" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={handleAvatarClick}>
                  Unggah Foto
                </button>
              </div>
              <form onSubmit={handleProfileUpdate}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nama Pengguna</label>
                  <input type="text" className="input-field" value={profileData.username} onChange={e => setProfileData({...profileData, username: e.target.value})} required />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Email</label>
                  <input type="email" className="input-field" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} required />
                </div>
                {user.role === 'admin' ? (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Kata Sandi Baru (Kosongkan jika tidak ingin ganti)</label>
                    <input type="password" className="input-field" value={profileData.newPassword} onChange={e => setProfileData({...profileData, newPassword: e.target.value})} placeholder="Masukkan kata sandi baru..." />
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Untuk mengganti kata sandi, keluar lalu gunakan <strong style={{ color: 'var(--primary)' }}>Lupa kata sandi?</strong> di halaman masuk (OTP via email).
                  </p>
                )}
                <AlertSettings />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowProfileModal(false)} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1rem' }}>Batal</button>
                  <button type="submit" className="btn-primary">Perbarui Profil</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <CustomConfirm 
          isOpen={confirmData.isOpen}
          title={confirmData.type === 'all_data' ? "Hapus SELURUH Data" : "Hapus Transaksi"}
          message={confirmData.type === 'all_data' 
            ? "PERINGATAN! Ini akan menghapus SEMUA data: transaksi, dompet, utang, kategori, tabungan, anggaran, langganan, jurnal, dan akun. Data tidak dapat dikembalikan. Yakin?" 
            : "Apakah Anda yakin ingin menghapus transaksi ini?"}
          onConfirm={executeConfirmAction}
          onCancel={() => setConfirmData({ isOpen: false, id: null, type: '' })}
          isDanger={true}
        />

      </div>

      <SiteFooter
        mode="app"
        onNavigate={handleFooterNav}
        showAdmin={user?.role === 'admin'}
      />
      </div>

      {/* Manual Circular Profile Crop Modal */}
      {showCropModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="glass-panel modal-content crop-modal-content">
            <h2 style={{ marginBottom: '0.5rem', textAlign: 'center', fontSize: '1.25rem' }}>Potong Foto Profil</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.4' }}>
              Seret gambar untuk memposisikan subjek dan geser slider di bawah untuk zoom
            </p>
            
            <div 
              className="crop-viewport"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img 
                src={cropImageSrc} 
                alt="To Crop" 
                className="crop-image-element"
                style={{
                  left: `${cropPos.x}px`,
                  top: `${cropPos.y}px`,
                  width: `${280 * zoom}px`,
                  height: 'auto'
                }}
              />
              <div className="crop-circle-guide"></div>
            </div>

            <div className="crop-slider-container">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>ZOOM</span>
              <input 
                type="range" 
                className="crop-range-slider"
                min="1" 
                max="3" 
                step="0.02"
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))} 
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => { setShowCropModal(false); setCropImageSrc(null); }} 
                style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem 1.25rem', fontWeight: '500' }}
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleCropSave} 
                className="btn-primary"
                style={{ padding: '0.5rem 1.5rem' }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      <FAQModal isOpen={showFaqModal} onClose={() => setShowFaqModal(false)} />
    </div>
  );
}
