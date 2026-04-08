import { create } from 'zustand';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/notifications');

export const useNotificationStore = create((set, get) => ({
    notifications: [],
    unreadCount: 0,
    prefs: {
        emailDigestEnabled: false,
        digestFrequency: 'daily',
        pushEnabled: false,
    },
    isLoading: false,
    error: null,

    fetchNotifications: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await fetch(`${API_URL}?limit=20`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch notifications');

            set({
                notifications: data.notifications,
                unreadCount: data.unreadCount,
                isLoading: false,
            });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    markAsRead: async (id) => {
        try {
            const res = await fetch(`${API_URL}/${id}/read`, {
                method: 'PUT',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to mark as read');

            set((state) => ({
                notifications: state.notifications.map((n) =>
                    n._id === id ? { ...n, readAt: new Date().toISOString() } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1),
            }));
            return data;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    markAllAsRead: async () => {
        try {
            const res = await fetch(`${API_URL}/read-all`, {
                method: 'PUT',
                credentials: 'include',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to mark all as read');
            }
            set((state) => ({
                notifications: state.notifications.map((n) => ({
                    ...n,
                    readAt: n.readAt || new Date().toISOString(),
                })),
                unreadCount: 0,
            }));
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    fetchPrefs: async () => {
        try {
            const res = await fetch(`${API_URL}/prefs`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch preferences');
            set({ prefs: data.prefs || get().prefs });
            return data.prefs;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    updatePrefs: async (partial) => {
        try {
            const res = await fetch(`${API_URL}/prefs`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(partial || {}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update preferences');
            set({ prefs: data.prefs || get().prefs });
            return data.prefs;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    // Called by socket listener for live push
    addNotification: (notification) => {
        set((state) => {
            // Avoid duplicates
            if (state.notifications.some((n) => n._id === notification._id)) return state;
            return {
                notifications: [notification, ...state.notifications],
                unreadCount: state.unreadCount + 1,
            };
        });
    },

    clearError: () => set({ error: null }),
}));
