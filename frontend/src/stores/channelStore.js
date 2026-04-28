import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/channels');

export const useChannelStore = create((set, get) => ({
    channels: [],
    categories: [],
    activeChannelId: null,
    isLoading: false,
    error: null,

    fetchChannels: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(API_URL, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch channels');
            set({ channels: data.channels, categories: data.categories || [], isLoading: false });
            return data.channels;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    createChannel: async (name, options = {}) => {
        set({ isLoading: true, error: null });
        try {
            const {
                description = '',
                isPremium = false,
                isPrivate = false,
                type = 'text',
                categoryId = null,
            } = options;
            const res = await apiFetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, description, isPremium, isPrivate, type, categoryId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create channel');

            set((state) => ({
                channels: [...state.channels, data.channel],
                isLoading: false,
            }));
            return data.channel;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updateChannelName: async (channelId, name) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/${channelId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update channel');
            set((state) => ({
                channels: state.channels.map((ch) => (ch._id === channelId ? data.channel : ch)),
                isLoading: false,
            }));
            return data.channel;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    deleteChannel: async (channelId) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/${channelId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete channel');
            set((state) => {
                const remaining = state.channels.filter((ch) => ch._id !== channelId);
                const nextActive = state.activeChannelId === channelId ? null : state.activeChannelId;
                return { channels: remaining, activeChannelId: nextActive, isLoading: false };
            });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    setActiveChannel: (channelId) => {
        set({ activeChannelId: channelId });
    },

    clearChannels: () => {
        set({ channels: [], activeChannelId: null, error: null, isLoading: false });
    },

    clearError: () => set({ error: null }),
}));
