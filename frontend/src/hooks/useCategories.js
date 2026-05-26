import api from '../services/api';
import { cachedFetch, makeCacheKey, invalidateCacheByPrefix } from '../services/clientCache';

const CACHE_KEY = makeCacheKey('/categories');

export async function fetchCategories() {
  return cachedFetch(
    () => api.get('/categories').then((r) => r.data),
    CACHE_KEY,
    60
  );
}

export function invalidateCategoriesCache() {
  invalidateCacheByPrefix('/categories');
}

export function categoryNames(categories) {
  return (categories || []).map((c) => c.name);
}

export function colorForCategory(categories, name) {
  const c = (categories || []).find((x) => x.name === name);
  return c?.color || '#6366f1';
}
