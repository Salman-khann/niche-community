const DEFAULT_DEV_API = 'http://localhost:3000';
const RAW_API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? DEFAULT_DEV_API : window.location.origin);
export const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');
const RAW_SOCKET_BASE = import.meta.env.VITE_SOCKET_URL || API_BASE_URL || (import.meta.env.DEV ? DEFAULT_DEV_API : '') || window.location.origin;
export const SOCKET_URL = RAW_SOCKET_BASE.replace(/\/+$/, '');

export const apiUrl = (path) => {
    if (!path) return API_BASE_URL || '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (!API_BASE_URL) return path;
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};
