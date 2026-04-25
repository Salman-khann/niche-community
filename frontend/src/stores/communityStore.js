import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { useAuthStore } from './authStore';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/communities');

export const useCommunityStore = create((set, get) => ({
    community: null,
    communityProfile: null,
    myCommunities: [],      // all communities the admin owns
    allCommunities: [],
    inviteCodes: [],
    isLoading: false,
    error: null,
    successMessage: null,

    // Create a new community
    createCommunity: async (name, description, slug, icon, kind, template) => {
        set({ isLoading: true, error: null, successMessage: null });
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, description, slug, icon, kind, template }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create community');
            set({
                community: data.community,
                isLoading: false,
                successMessage: 'Community created successfully!',
            });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Generate invite code + optional email
    generateInvite: async (communityId, email) => {
        set({ isLoading: true, error: null, successMessage: null });
        try {
            const res = await apiFetch(`${API_URL}/${communityId}/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: email || undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to generate invite');

            // Optimistically add the new code to the list
            set((s) => ({
                inviteCodes: [
                    {
                        code: data.code,
                        isUsed: false,
                        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        _id: Date.now().toString(),
                    },
                    ...s.inviteCodes,
                ],
                isLoading: false,
                successMessage: data.message,
            }));
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Send a direct invite to an existing user
    sendServerInvite: async (communityId, userId) => {
        set({ isLoading: true, error: null, successMessage: null });
        try {
            const res = await apiFetch(`${API_URL}/${communityId}/invites/direct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send invite');
            set({ isLoading: false, successMessage: data.message || 'Invite sent' });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Fetch all invite codes for a community
    fetchInviteCodes: async (communityId) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/${communityId}/invites`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch invite codes');
            set({
                inviteCodes: data.inviteCodes || [],
                community: { ...get().community, name: data.communityName },
                isLoading: false,
            });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Fetch the community owned by the current user (single)
    fetchMyCommunity: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/mine`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'No community found');
            set({ community: data.community, isLoading: false });
            return data.community;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Fetch ALL communities owned by the current user (for multi-community admins)
    fetchMyCommunities: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/mine-all`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch communities');
            const communities = data.communities || [];
            set({
                myCommunities: communities,
                // Auto-select first community if none selected yet
                community: get().community || (communities[0] ?? null),
                isLoading: false,
            });
            return communities;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Fetch ALL communities in the app (directory)
    fetchAllCommunities: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/all`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch communities');
            set({
                allCommunities: data.communities || [],
                isLoading: false,
            });
            return data.communities || [];
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Switch the active community shown in invite management
    selectCommunity: (communityObj) => {
        set({ community: communityObj, inviteCodes: [] });
    },

    // Fetch server profile settings
    fetchCommunityProfile: async (communityId) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/${communityId}/profile`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch server profile');
            set({ communityProfile: data.profile, isLoading: false });
            return data.profile;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Update server profile settings (admin only)
    updateCommunityProfile: async (communityId, payload) => {
        set({ isLoading: true, error: null, successMessage: null });
        try {
            const res = await apiFetch(`${API_URL}/${communityId}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update server profile');

            set({ communityProfile: data.profile, isLoading: false, successMessage: data.message || 'Server profile updated' });

            const { user, setUser } = useAuthStore.getState();
            if (user?.memberships && data.profile?._id) {
                const updatedMemberships = user.memberships.map((m) => {
                    const mId = m.communityId?._id || m.communityId;
                    if (mId?.toString?.() === data.profile._id.toString()) {
                        if (typeof m.communityId === 'object' && m.communityId !== null) {
                            return {
                                ...m,
                                communityId: {
                                    ...m.communityId,
                                    name: data.profile.name,
                                    icon: data.profile.icon || '',
                                },
                            };
                        }
                        return m;
                    }
                    return m;
                });
                setUser({ ...user, memberships: updatedMemberships });
            }
            return data.profile;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    reorderRoles: async (communityId, roleOrder) => {
        // roleOrder: [{ _id, position }]
        try {
            const res = await apiFetch(`${API_URL}/${communityId}/roles/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ roles: roleOrder }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to reorder roles');
            set({ successMessage: 'Role order updated' });
            return data;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    getBannedUsers: async (communityId) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/${communityId}/bans`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch bans');
            set({ isLoading: false });
            return data.bans || [];
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    deleteCommunity: async (communityId) => {
        set({ isLoading: true, error: null, successMessage: null });
        try {
            const res = await apiFetch(`${API_URL}/${communityId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete server');
            set({ isLoading: false, successMessage: data.message || 'Server deleted' });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
    clearSuccess: () => set({ successMessage: null }),
}));
