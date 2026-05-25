/**
 * clientCache.js
 * Cache ringan di memory browser — mengurangi request duplikat ke TiDB.
 * TTL default: 30 detik. Tidak persisten (hilang saat refresh halaman).
 */

const cache = new Map(); // key: string → { data, expiresAt }
const inFlight = new Map(); // key: string → Promise (request deduplication)

/**
 * Buat cache key dari URL dan params.
 * @param {string} url
 * @param {object} [params]
 * @returns {string}
 */
export function makeCacheKey(url, params = {}) {
    const query = Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';
    return url + query;
}

/**
 * Simpan data ke cache.
 * @param {string} key
 * @param {*} data
 * @param {number} ttlSeconds - default 30 detik
 */
export function setCache(key, data, ttlSeconds = 30) {
    cache.set(key, {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000
    });
}

/**
 * Ambil data dari cache jika masih valid.
 * @param {string} key
 * @returns {*|null} data atau null jika expired/tidak ada
 */
export function getCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

/**
 * Hapus satu entry cache.
 * @param {string} key
 */
export function invalidateCache(key) {
    cache.delete(key);
}

/**
 * Hapus semua cache yang key-nya mengandung prefix tertentu.
 * Berguna setelah mutasi data (POST/PUT/DELETE).
 * @param {string} prefix
 */
export function invalidateCacheByPrefix(prefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
}

/**
 * GET dengan cache + request deduplication.
 * - Jika data ada di cache → langsung return (0 request)
 * - Jika request yang sama sedang berjalan → tunggu hasilnya (1 request)
 * - Jika tidak ada → fetch, cache hasilnya
 *
 * @param {function} fetchFn - fungsi async yang mengembalikan data
 * @param {string} key - cache key
 * @param {number} ttlSeconds
 * @returns {Promise<*>}
 */
export async function cachedFetch(fetchFn, key, ttlSeconds = 30) {
    // Hit cache
    const cached = getCache(key);
    if (cached !== null) return cached;

    // Deduplication: request yang sama sedang berjalan
    if (inFlight.has(key)) return inFlight.get(key);

    // Fetch baru
    const promise = fetchFn()
        .then(data => {
            setCache(key, data, ttlSeconds);
            inFlight.delete(key);
            return data;
        })
        .catch(err => {
            inFlight.delete(key);
            throw err;
        });

    inFlight.set(key, promise);
    return promise;
}

/**
 * Hapus semua cache (misal: saat logout).
 */
export function clearAllCache() {
    cache.clear();
    inFlight.clear();
}
