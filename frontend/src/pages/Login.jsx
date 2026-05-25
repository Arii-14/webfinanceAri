import { useState, useContext } from 'react';
import { AuthContext } from '../App';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import PasswordInput from '../components/PasswordInput';
import SiteFooter from '../components/SiteFooter';

export default function Login() {
  const { setUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [registerStep, setRegisterStep] = useState(1);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [forgotData, setForgotData] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  const [error, setError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resetRegister = () => {
    setRegisterStep(1);
    setRegisterOtp('');
    setRegisterMessage('');
    setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    setError('');
  };

  const resetForgot = () => {
    setShowForgot(false);
    setForgotStep(1);
    setForgotData({ email: '', otp: '', newPassword: '', confirmPassword: '' });
    setForgotMessage('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { email: formData.email, password: formData.password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleRegisterRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setRegisterMessage('');

    if (formData.password !== formData.confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register/request-otp', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      setRegisterMessage(res.data.message);
      setRegisterStep(2);
      showToast('Kode OTP telah dikirim ke email Anda.', 'success');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengirim OTP pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterVerify = async (e) => {
    e.preventDefault();
    setError('');
    setRegisterMessage('');

    if (!/^\d{5}$/.test(registerOtp.trim())) {
      setError('Kode OTP harus 5 digit angka.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register/verify', {
        email: formData.email,
        otp: registerOtp.trim(),
      });
      showToast(res.data.message, 'success');
      resetRegister();
      setIsLogin(true);
      setFormData((prev) => ({ ...prev, username: '', password: '', confirmPassword: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyelesaikan pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setForgotMessage('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotData.email });
      setForgotMessage(res.data.message);
      setForgotStep(2);
      showToast('Kode OTP telah dikirim ke email Anda.', 'success');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengirim OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setForgotMessage('');

    if (forgotData.newPassword !== forgotData.confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (forgotData.newPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (!/^\d{5}$/.test(forgotData.otp.trim())) {
      setError('Kode OTP harus 5 digit angka.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        email: forgotData.email,
        otp: forgotData.otp.trim(),
        newPassword: forgotData.newPassword,
      });
      showToast(res.data.message, 'success');
      resetForgot();
      setIsLogin(true);
      setFormData((prev) => ({ ...prev, email: forgotData.email, password: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal reset kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  const renderForgot = () => (
    <div>
      <button
        type="button"
        onClick={resetForgot}
        style={{ background: 'transparent', color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}
      >
        ← Kembali ke masuk
      </button>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Reset Kata Sandi</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        {forgotStep === 1
          ? 'Masukkan email terdaftar. Kode OTP 5 digit akan dikirim (berlaku 5 menit).'
          : 'Masukkan kode OTP dari email dan kata sandi baru.'}
      </p>

      {error && (
        <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem' }}>
          {error}
        </div>
      )}
      {forgotMessage && forgotStep === 2 && (
        <div style={{ color: 'var(--success)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '0.5rem', fontSize: '0.9rem' }}>
          {forgotMessage}
        </div>
      )}

      {forgotStep === 1 ? (
        <form onSubmit={handleSendOtp}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="input-field"
              value={forgotData.email}
              onChange={(e) => setForgotData({ ...forgotData, email: e.target.value })}
              required
              placeholder="email@contoh.com"
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword}>
          <div className="form-group">
            <label>Kode OTP (5 digit)</label>
            <input
              type="text"
              className="input-field"
              value={forgotData.otp}
              onChange={(e) => setForgotData({ ...forgotData, otp: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              required
              placeholder="12345"
              maxLength={5}
              inputMode="numeric"
            />
          </div>
          <div className="form-group">
            <label>Kata Sandi Baru</label>
            <PasswordInput
              value={forgotData.newPassword}
              onChange={(e) => setForgotData({ ...forgotData, newPassword: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Minimal 6 karakter"
            />
          </div>
          <div className="form-group">
            <label>Konfirmasi Kata Sandi</label>
            <PasswordInput
              value={forgotData.confirmPassword}
              onChange={(e) => setForgotData({ ...forgotData, confirmPassword: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Ulangi kata sandi baru"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', padding: '0.75rem' }}
              onClick={() => setForgotStep(1)}
            >
              Kirim Ulang OTP
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? 'Memproses...' : 'Reset Kata Sandi'}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className="auth-page-wrap" id="top">
    <div className="auth-page fade-in">
      <div className="auth-container">
        <div className="auth-left">
          {!showForgot ? (
            <>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {isLogin ? 'Selamat Datang Kembali' : 'Buat Akun Baru'}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                {isLogin
                  ? 'Kelola keuangan Anda dengan cerdas.'
                  : registerStep === 1
                    ? 'Daftar dengan verifikasi email OTP (berlaku 5 menit).'
                    : 'Masukkan kode OTP dari email untuk menyelesaikan pendaftaran.'}
              </p>

              {error && (
                <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem' }}>
                  {error}
                </div>
              )}
              {!isLogin && registerMessage && registerStep === 2 && (
                <div style={{ color: 'var(--success)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '0.5rem', fontSize: '0.9rem' }}>
                  {registerMessage}
                </div>
              )}

              {isLogin ? (
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      className="input-field"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Kata Sandi</label>
                    <PasswordInput
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      autoComplete="current-password"
                      placeholder="Masukkan kata sandi"
                    />
                  </div>
                  <p style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                    <span
                      style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
                      onClick={() => {
                        setShowForgot(true);
                        setForgotData((d) => ({ ...d, email: formData.email }));
                        setError('');
                      }}
                    >
                      Lupa kata sandi?
                    </span>
                  </p>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                    Masuk
                  </button>
                </form>
              ) : registerStep === 1 ? (
                <form onSubmit={handleRegisterRequestOtp}>
                  <div className="form-group">
                    <label>Nama Pengguna</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      className="input-field"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="email@contoh.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Kata Sandi</label>
                    <PasswordInput
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      autoComplete="new-password"
                      placeholder="Minimal 6 karakter"
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label>Konfirmasi Kata Sandi</label>
                    <PasswordInput
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      autoComplete="new-password"
                      placeholder="Ulangi kata sandi"
                      minLength={6}
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                    {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterVerify}>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="input-field" value={formData.email} readOnly style={{ opacity: 0.8 }} />
                  </div>
                  <div className="form-group">
                    <label>Kode OTP (5 digit)</label>
                    <input
                      type="text"
                      className="input-field"
                      value={registerOtp}
                      onChange={(e) => setRegisterOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      required
                      placeholder="12345"
                      maxLength={5}
                      inputMode="numeric"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', padding: '0.75rem' }}
                      onClick={() => setRegisterStep(1)}
                      disabled={loading}
                    >
                      Kirim Ulang OTP
                    </button>
                    <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={loading}>
                      {loading ? 'Memproses...' : 'Selesaikan Daftar'}
                    </button>
                  </div>
                </form>
              )}

              <p style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                <span
                  style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600' }}
                  onClick={() => {
                    if (isLogin) {
                      setIsLogin(false);
                      resetRegister();
                    } else {
                      resetRegister();
                      setIsLogin(true);
                    }
                    setError('');
                  }}
                >
                  {isLogin ? 'Daftar' : 'Masuk'}
                </span>
              </p>
            </>
          ) : (
            renderForgot()
          )}
        </div>

        <div className="auth-right">
          <div className="glass-panel" style={{ textAlign: 'left', maxWidth: '400px' }}>
            <p className="quote" style={{ lineHeight: 1.6, fontSize: '1rem' }}>
              &ldquo;Jangan biarkan uang menguasai hidupmu, sebaliknya, kuasailah uangmu agar dapat menjalani hidup sesuai dengan nilai dan tujuanmu.&rdquo;
            </p>
            <p className="quote-author" style={{ marginTop: '1rem', color: 'var(--primary)', fontWeight: 700 }}>
              — TendouAriisu
            </p>
          </div>
        </div>
      </div>
    </div>
    <SiteFooter mode="public" />
    </div>
  );
}
