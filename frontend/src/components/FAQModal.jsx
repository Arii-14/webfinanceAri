import { X, LayoutDashboard, ReceiptText, Wallet, HandCoins, Target, BookHeart } from 'lucide-react';

export default function FAQModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel modal-content fade-in" style={{ 
        width: '100%', 
        maxWidth: '550px', 
        maxHeight: '90vh',
        display: 'flex', 
        flexDirection: 'column',
        padding: '1.5rem',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Panduan Penggunaan</h2>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none' }}>
            <X size={24} />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div style={{ overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--primary)' }}>
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Ringkasan (Dashboard)</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Halaman utama untuk melihat kondisi uang kamu saat ini. Ada info total saldo, uang yang masuk bulan ini, uang yang keluar, dan pengingat sisa jatah (anggaran) uang kamu agar tidak boros.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--success)' }}>
              <ReceiptText size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Transaksi</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Tempat mencatat setiap kali kamu menerima uang (Pemasukan) atau jajan/membeli sesuatu (Pengeluaran). Wajib diisi supaya catatan uangnya akurat!
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: '#f59e0b' }}>
              <Wallet size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Anggaran (Batas Jajan)</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Atur "jatah uang" untuk setiap kebutuhan. Misalnya, jatah jajan bulan ini cuma Rp 500rb. Kalau kamu catat pengeluaran mendekati Rp 500rb, sistem akan kasih peringatan warna merah.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--danger)' }}>
              <HandCoins size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Utang & Piutang</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Jangan sampai lupa kalau kamu minjem uang ke teman (Utang), atau teman minjem uang ke kamu (Piutang). Catat di sini biar gampang nagihnya!
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: '#3b82f6' }}>
              <Target size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Target Tabungan</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Punya mimpi beli HP baru atau liburan? Buat targetnya di sini. Kamu bisa pantau uang tabunganmu sudah terkumpul berapa persen dari harga barang impianmu.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: '#ec4899' }}>
              <BookHeart size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Catatan Pribadi</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Buku harian rahasia kamu. Boleh diisi tentang perasaan hari ini atau rencana besok. Fitur ini tidak berhubungan dengan hitung-hitungan uang kok!
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
