import { create } from 'zustand';
import { apiFetch } from './apiFetch';

export const useMemberStore = create((set, get) => ({
    members: [],
    isLoading: false,
    error: null,
    successMessage: null,

    fetchMembers: async (communityId) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`/api/communities/${communityId}/members`, {
                credentials: 'include',
                headers: { 'x-community-id': communityId },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch members');
            set({ members: data.members, isLoading: false });
        } catch (err) {
            set({ error: err.message, isLoading: false });
            throw err;
        }
    },

    updateRole: async (communityId, userId, role) => {
        // Optimistic update
        const prev = get().members;
        set((s) => ({
            members: s.members.map((m) =>
                m._id === userId ? { ...m, communityRole: role } : m
            ),
        }));

        try {
            const res = await apiFetch(`/api/communities/${communityId}/members/${userId}/role`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-community-id': communityId,
                },
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update role');
            set({ successMessage: data.message });
            return data;
        } catch (err) {
            // Rollback
            set({ members: prev, error: err.message });
            throw err;
        }
    },

    banMember: async (communityId, userId, reason = 'Banned from settings') => {
        try {
            const res = await apiFetch(`/api/moderate/ban/${userId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'x-community-id': communityId, 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to ban member');
            // Remove from list immediately
            set((s) => ({
                members: s.members.filter((m) => m._id !== userId),
                successMessage: data.message
            }));
            return data;
        } catch (err) {
            set({ error: err.message });
            throw err;
        }
    },

    unbanMember: async (communityId, userId) => {
        try {
            const res = await apiFetch(`/api/moderate/unban/${userId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'x-community-id': communityId, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to unban member');
            set({ successMessage: data.message });
            return data;
        } catch (err) {
            set({ error: err.message });
            throw err;
        }
    },

    kickMember: async (communityId, userId) => {
        const prev = get().members;
        set((s) => ({
            members: s.members.filter((m) => m._id !== userId),
        }));

        try {
            const res = await apiFetch(`/api/communities/${communityId}/members/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'x-community-id': communityId },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to kick member');
            set({ successMessage: data.message });
            return data;
        } catch (err) {
            set({ members: prev, error: err.message });
            throw err;
        }
    },

    updateRoles: async (communityId, userId, roleIds) => {
        const prev = get().members;
        set((s) => ({
            members: s.members.map((m) =>
                m._id === userId ? { ...m, roleIds } : m
            ),
        }));

        try {
            const res = await apiFetch(`/api/communities/${communityId}/members/${userId}/roles`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-community-id': communityId,
                },
                body: JSON.stringify({ roleIds }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update roles');
            set({ successMessage: 'Member roles updated' });
            return data;
        } catch (err) {
            set({ members: prev, error: err.message });
            throw err;
        }
    },

    removeMember: (userId) => {
        set((s) => ({
            members: s.members.filter((m) => m._id !== userId),
        }));
    },

    clearError: () => set({ error: null }),
    clearSuccess: () => set({ successMessage: null }),
}));
