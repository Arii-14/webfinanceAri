import axios from 'axios';
import { clearAllCache } from './clientCache';

const api = axios.create({
    baseURL: '/api'
});

// ─── Request Interceptor: tambah Authorization header ────────────────────────
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─── Response Interceptor: tangani error global ──────────────────────────────
api.interceptors.response.use(
    response => response,
    error => {
        const status = error.response?.status;

        // 429 — Rate limit / anti-spam
        if (status === 429) {
            const pesan = error.response?.data?.error ||
                'Terlalu banyak permintaan. Harap tunggu 2 menit sebelum mencoba lagi.';
            const retryAfter = error.response?.data?.retryAfter || null;

            // Simpan info rate limit ke window agar komponen bisa baca
            window.__rateLimitedUntil = retryAfter || (Date.now() + 2 * 60 * 1000);
            window.dispatchEvent(new CustomEvent('rateLimited', {
                detail: { message: pesan, retryAfter: window.__rateLimitedUntil }
            }));

            // Override pesan error supaya toast bisa tampilkan teks Indonesia
            error.message = pesan;
            if (error.response) error.response.data = { error: pesan };
        }

        // 401 — Token expired/tidak valid → logout otomatis
        if (status === 401) {
            const isLoginPage = window.location.pathname === '/login';
            if (!isLoginPage) {
                clearAllCache();
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;
