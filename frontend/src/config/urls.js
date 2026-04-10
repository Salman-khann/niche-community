const DEFAULT_DEV_API = 'http://localhost:3000';
const normalizeBaseUrl = (value, fallback) => {
    const raw = String(value || fallback || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
        return raw.replace(/\/+$/, '');
    }
    return `https://${raw.replace(/\/+$/, '')}`;
};

const RAW_API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? DEFAULT_DEV_API : window.location.origin);
export const API_BASE_URL = normalizeBaseUrl(RAW_API_BASE, import.meta.env.DEV ? DEFAULT_DEV_API : window.location.origin)
    .replace(/\/api$/i, '');
const RAW_SOCKET_BASE = import.meta.env.VITE_SOCKET_URL || API_BASE_URL || (import.meta.env.DEV ? DEFAULT_DEV_API : '') || window.location.origin;
export const SOCKET_URL = normalizeBaseUrl(RAW_SOCKET_BASE, API_BASE_URL || (import.meta.env.DEV ? DEFAULT_DEV_API : window.location.origin));

export const apiUrl = (path) => {
    if (!path) return API_BASE_URL || '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (!API_BASE_URL) return path;
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};
