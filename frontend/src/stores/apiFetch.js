/**
 * apiFetch — thin wrapper around native `fetch` that:
 * 1. Automatically injects `x-community-id` from the workspace store
 * 2. Intercepts 403 SUSPENDED / BANNED responses and redirects to /suspended
 *
 * Usage is identical to `fetch(url, options)`.
 */
import { useWorkspaceStore } from './workspaceStore';
import { apiUrl } from '../config/urls';

const safeReadJson = async (response) => {
    if (!response) return {};
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const bodyText = await response.text();
    if (!bodyText) return {};
    if (!contentType.includes('application/json')) return { message: bodyText };
    try {
        return JSON.parse(bodyText);
    } catch {
        return { message: bodyText };
    }
};

export const apiFetch = async (url, options = {}) => {
    const finalUrl = apiUrl(url);
    const communityId = useWorkspaceStore.getState().activeCommunityId;

    const headers = { ...(options.headers || {}) };

    if (communityId) {
        headers['x-community-id'] = communityId;
    }

    const res = await fetch(finalUrl, { ...options, headers });

    // ── Suspension / ban interceptor ─────────────────────────────────────────
    if (res.status === 403) {
        // Clone so the body can still be read by the caller if needed
        const clone = res.clone();
        try {
            const data = await safeReadJson(clone);
            if (data.code === 'SUSPENDED' || data.code === 'BANNED') {
                sessionStorage.setItem('suspensionData', JSON.stringify({
                    code: data.code,
                    liftAt: data.liftAt ?? null,
                    message: data.message ?? '',
                }));
                window.location.href = '/suspended';
            }
        } catch {
            // Not JSON or parse error — let caller handle normally
        }
    }

    return res;
};
