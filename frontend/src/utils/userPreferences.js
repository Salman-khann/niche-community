const STORAGE_KEY = 'circlecore-user-preferences';

const DEFAULT_PREFERENCES = {
    appearance: {
        theme: 'dark',
        reduceMotion: false,
    },
    accessibility: {
        textSize: 'medium',
        contrast: 'normal',
    },
    voice: {
        inputMode: 'voice',
        noiseSuppression: true,
        cameraPreview: true,
        autoplayMedia: true,
        cameraDeviceId: '',
    },
    languageTime: {
        language: 'en-US',
        format: 'auto',
    },
};

const deepMerge = (base, patch) => {
    const result = Array.isArray(base) ? [...base] : { ...base };
    Object.entries(patch || {}).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
            result[key] = deepMerge(base[key], value);
        } else if (value !== undefined) {
            result[key] = value;
        }
    });
    return result;
};

export const loadUserPreferences = () => {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_PREFERENCES;
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULT_PREFERENCES, parsed);
    } catch {
        return DEFAULT_PREFERENCES;
    }
};

export const applyUserPreferences = (preferences = loadUserPreferences()) => {
    const next = deepMerge(DEFAULT_PREFERENCES, preferences);
    if (typeof document === 'undefined') return next;

    const root = document.documentElement;
    const body = document.body;
    const sizeMap = {
        small: 0.94,
        medium: 1,
        large: 1.08,
        xlarge: 1.16,
    };

    root.dataset.textSize = next.accessibility.textSize || 'medium';
    root.dataset.contrast = next.accessibility.contrast || 'normal';
    root.dataset.theme = next.appearance.theme || 'dark';
    root.dataset.reduceMotion = next.appearance.reduceMotion ? 'true' : 'false';
    root.style.setProperty('--app-font-scale', String(sizeMap[next.accessibility.textSize] || 1));
    body.dataset.theme = next.appearance.theme || 'dark';
    body.dataset.contrast = next.accessibility.contrast || 'normal';
    body.dataset.reduceMotion = next.appearance.reduceMotion ? 'true' : 'false';

    return next;
};

export const saveUserPreferences = (patch = {}) => {
    const current = loadUserPreferences();
    const next = deepMerge(current, patch);
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        applyUserPreferences(next);
        window.dispatchEvent(new CustomEvent('circlecore:user-preferences-changed', { detail: next }));
    }
    return next;
};

export const getUserPreferences = () => loadUserPreferences();
