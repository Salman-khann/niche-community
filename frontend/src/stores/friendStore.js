import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/friends');

export const useFriendStore = create((set) => ({
    friends: [],
    onlineCount: 0,
    incoming: [],
    outgoing: [],
    searchResults: [],
    isLoading: false,
    error: null,
    success: null,

    fetchFriends: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(API_URL, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch friends');
            set({ friends: data.friends || [], onlineCount: data.onlineCount || 0, isLoading: false });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    fetchRequests: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/requests`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch requests');
            set({ incoming: data.incoming || [], outgoing: data.outgoing || [], isLoading: false });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    searchUsers: async (query, limit = 10) => {
        const q = (query || '').trim();
        if (q.length < 2) {
            set({ searchResults: [] });
            return [];
        }
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/search?q=${encodeURIComponent(q)}&limit=${limit}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to search users');
            const users = data.users || [];
            set({ searchResults: users, isLoading: false });
            return users;
        } catch (error) {
            set({ isLoading: false, error: error.message, searchResults: [] });
            throw error;
        }
    },

    sendRequest: async (targetId) => {
        set({ isLoading: true, error: null, success: null });
        try {
            const res = await apiFetch(`${API_URL}/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ targetId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send request');
            set({ isLoading: false, success: data.message || 'Request sent' });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    acceptRequest: async (requesterId) => {
        const res = await apiFetch(`${API_URL}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ requesterId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to accept request');
        return data;
    },

    declineRequest: async (requesterId) => {
        const res = await apiFetch(`${API_URL}/decline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ requesterId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to decline request');
        return data;
    },

    removeFriend: async (targetId) => {
        set({ isLoading: true, error: null, success: null });
        try {
            const res = await apiFetch(`${API_URL}/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ targetId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to remove friend');
            set((state) => {
                const nextFriends = state.friends.filter((f) => f._id !== targetId);
                    const onlineCount = nextFriends.filter((f) => f.presence !== 'offline').length;
                return { friends: nextFriends, onlineCount, isLoading: false, success: data.message || 'Friend removed' };
            });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updatePresence: (userId, presence) => set((state) => {
        if (!userId) return state;
        const friends = state.friends.map((f) =>
            f._id === userId ? { ...f, presence: presence || f.presence } : f
        );
        const onlineCount = friends.filter((f) => f.presence !== 'offline').length;
        return { friends, onlineCount };
    }),

    removeOutgoing: (userId) => set((state) => ({
        outgoing: state.outgoing.filter((r) => r._id !== userId),
    })),

    clearMessages: () => set({ error: null, success: null }),
}));
