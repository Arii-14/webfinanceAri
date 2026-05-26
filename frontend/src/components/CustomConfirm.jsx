import { AlertTriangle, Info } from 'lucide-react';

export default function CustomConfirm({ isOpen, title, message, onConfirm, onCancel, isDanger = true }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="glass-panel modal-content fade-in" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          {isDanger ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%' }}>
              <AlertTriangle size={32} color="var(--danger)" />
            </div>
          ) : (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '50%' }}>
              <Info size={32} color="var(--primary)" />
            </div>
          )}
        </div>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            Batal
          </button>
          <button onClick={onConfirm} style={{ flex: 1, background: isDanger ? 'var(--danger)' : 'var(--primary)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold' }}>
            Ya, Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}
