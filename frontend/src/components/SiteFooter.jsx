import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import SocialIcon from './SocialIcon';

const CONTACTS = [
  { id: 'gmail', label: 'Gmail', value: 'muhammadariusni@gmail.com', href: 'mailto:muhammadariusni@gmail.com' },
  { id: 'github', label: 'GitHub', value: 'Arii-14', href: 'https://github.com/Arii-14' },
  { id: 'whatsapp', label: 'WhatsApp', value: '081396368305', href: 'https://wa.me/6281396368305' },
  {
    id: 'instagram',
    label: 'Instagram',
    value: '@arii_withfeelings',
    href: 'https://www.instagram.com/arii_withfeelings?igsh=cGIxaHFoYWUycnR0',
  },
];

const APP_FEATURES = [
  'Ringkasan & grafik analitik keuangan',
  'Transaksi pemasukan & pengeluaran',
  'Multi-dompet & transfer antar dompet',
  'Pelacak utang, piutang & cicilan',
  'Kategori kustom berwarna',
  'Anggaran bulanan & peringatan pintar',
  'Target tabungan & progress',
  'Langganan & jatuh tempo',
  'Catatan jurnal & mood',
  'Vault akun terenkripsi',
  'Notifikasi email cerdas',
];

const NAV_SECTIONS = [
  {
    title: 'Utama',
    links: [
      { label: 'Home', tab: 'dashboard', path: '/' },
      { label: 'Dashboard', tab: 'dashboard' },
      { label: 'Analytics', tab: 'dashboard' },
    ],
  },
  {
    title: 'Keuangan',
    links: [
      { label: 'Transaksi', tab: 'transactions' },
      { label: 'Dompet', tab: 'wallets' },
      { label: 'Utang & Piutang', tab: 'debts' },
      { label: 'Kategori', tab: 'categories' },
      { label: 'Anggaran', tab: 'budgets' },
      { label: 'Target Tabungan', tab: 'savings' },
    ],
  },
  {
    title: 'Lainnya',
    links: [
      { label: 'Langganan', tab: 'subscriptions' },
      { label: 'Catatan Pribadi', tab: 'journals' },
      { label: 'Manajemen Akun', tab: 'accounts' },
      { label: 'Pengaturan Profil', tab: 'profile', action: 'profile' },
    ],
  },
];

function FooterRule() {
  return <div className="site-footer__rule" aria-hidden>━━━━━━━━━━━━━━━━━━━━</div>;
}

function NavButton({ link, onNavigate }) {
  if (link.action === 'profile') {
    return (
      <button type="button" className="site-footer__nav-link" onClick={() => onNavigate?.('profile')}>
        {link.label}
      </button>
    );
  }
  return (
    <button type="button" className="site-footer__nav-link" onClick={() => onNavigate?.(link.tab)}>
      {link.label}
    </button>
  );
}

export default function SiteFooter({ mode = 'public', onNavigate, showAdmin = false }) {
  const year = new Date().getFullYear();
  const isApp = mode === 'app';

  const navSections = [...NAV_SECTIONS];
  if (showAdmin) {
    navSections.push({
      title: 'Admin',
      links: [{ label: 'Panel Admin', path: '/admin' }],
    });
  }

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <FooterRule />

        <div className="site-footer__top">
          <div className="site-footer__brand">
            <p className="site-footer__tagline">
              Built with passion &amp; caffeine <span className="site-footer__caffeine">☕</span>
              <br />
              by <strong>Ari</strong>.
            </p>
            <p className="site-footer__quote">
              Managing money should be simple,
              <br />
              not stressful.
            </p>
            <div className="site-footer__contact">
              <span className="site-footer__contact-label">find my contact:</span>
              <ul className="site-footer__social-list">
                {CONTACTS.map((c) => (
                  <li key={c.id}>
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`site-footer__social-link site-footer__social-link--${c.id}`}
                    >
                      <SocialIcon name={c.id} />
                      <span>
                        <strong>{c.label}:</strong> {c.value}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="site-footer__product">
            <div className="site-footer__logo-wrap">
              <BrandLogo size={96} className="site-footer__logo" />
              <div>
                <p className="site-footer__product-name">TendouAriisu</p>
                <p className="site-footer__product-sub">Finance</p>
              </div>
            </div>
            <p className="site-footer__product-lead">
              Kelola keuangan pribadi — transaksi, dompet, anggaran, tabungan, utang, dan insight visual dalam satu aplikasi.
            </p>
            <ul className="site-footer__feature-list">
              {APP_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="site-footer__divider" />

        <nav className="site-footer__nav" aria-label="Navigasi footer">
          <p className="site-footer__nav-title">Navigation</p>
          <div className="site-footer__nav-grid">
            {navSections.map((section) => (
              <div key={section.title} className="site-footer__nav-col">
                <h4>{section.title}</h4>
                <ul>
                  {section.links.map((link) => (
                    <li key={link.label}>
                      {isApp && !link.path ? (
                        <NavButton link={link} onNavigate={onNavigate} />
                      ) : link.path === '/admin' ? (
                        <Link to="/admin" className="site-footer__nav-link">
                          {link.label}
                        </Link>
                      ) : link.path === '/' ? (
                        isApp ? (
                          <button type="button" className="site-footer__nav-link" onClick={() => onNavigate?.('dashboard')}>
                            {link.label}
                          </button>
                        ) : (
                          <a href="#top" className="site-footer__nav-link">
                            {link.label}
                          </a>
                        )
                      ) : (
                        <span className="site-footer__nav-link site-footer__nav-link--muted" title="Masuk untuk mengakses">
                          {link.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <FooterRule />

        <p className="site-footer__copy">
          © {year} Ari (TendouAriisu) Finance
        </p>
      </div>
    </footer>
  );
}
