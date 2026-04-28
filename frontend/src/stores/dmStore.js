import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/dm');

export const useDmStore = create((set) => ({
    threadId: null,
    messages: [],
    threads: [],
    isLoading: false,
    error: null,

    openThread: async (userId) => {
        set({ isLoading: true, error: null });
        const res = await apiFetch(`${API_URL}/thread/${userId}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to open thread');
        set({ threadId: data.threadId, isLoading: false });
        return data.threadId;
    },

    setThreadId: (threadId) => set({ threadId }),

    fetchThreads: async () => {
        set({ isLoading: true, error: null });
        const res = await apiFetch(`${API_URL}/threads`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load threads');
        set({ threads: data.threads || [], isLoading: false });
        return data.threads || [];
    },

    fetchThreadInfo: async (threadId) => {
        set({ isLoading: true, error: null });
        const res = await apiFetch(`${API_URL}/thread-info/${threadId}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load thread');
        set((state) => {
            const next = state.threads.filter((t) => t._id !== data.thread?._id);
            return { threads: data.thread ? [data.thread, ...next] : next, isLoading: false };
        });
        return data.thread;
    },

    createGroupThread: async (participantIds) => {
        const res = await apiFetch(`${API_URL}/group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ participantIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create group');
        set((state) => {
            const next = state.threads.filter((t) => t._id !== data.thread?._id);
            return { threads: data.thread ? [data.thread, ...next] : next };
        });
        return data.thread;
    },

    addParticipants: async (threadId, participantIds) => {
        const res = await apiFetch(`${API_URL}/thread/${threadId}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ participantIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to add participants');
        set((state) => {
            const next = state.threads.filter((t) => t._id !== data.thread?._id);
            return { threads: data.thread ? [data.thread, ...next] : next };
        });
        return data.thread;
    },
    leaveThread: async (threadId) => {
        const res = await apiFetch(`${API_URL}/thread/${threadId}/leave`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to leave group');
        return data;
    },
    removeThread: (threadId) => set((state) => ({
        threads: state.threads.filter((t) => t._id !== threadId),
    })),

    upsertThread: (thread) => set((state) => {
        if (!thread?._id) return state;
        const next = state.threads.filter((t) => t._id !== thread._id);
        return { threads: [thread, ...next] };
    }),

    fetchMessages: async (threadId) => {
        set({ isLoading: true, error: null });
        const res = await apiFetch(`${API_URL}/messages/${threadId}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load messages');
        set({ messages: data.messages || [], isLoading: false });
        return data.messages || [];
    },

    sendMessage: async (threadId, payload) => {
        const res = await apiFetch(`${API_URL}/messages/${threadId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to send message');
        return data.message;
    },

    pushMessage: (msg) => set((state) => {
        if (state.messages.some((m) => m._id === msg._id)) return state;
        return { messages: [...state.messages, msg] };
    }),

    deleteMessage: async (threadId, messageId) => {
        const res = await apiFetch(`${API_URL}/messages/${threadId}/${messageId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to delete message');
        set((state) => ({
            messages: state.messages.filter((m) => m._id !== messageId),
        }));
        return data;
    },

    handleMessageDeleted: (payload) => set((state) => ({
        messages: state.messages.filter((m) => m._id !== payload.messageId),
    })),

    editMessage: async (threadId, messageId, content) => {
        const res = await apiFetch(`${API_URL}/messages/${threadId}/${messageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to edit message');
        set((state) => ({
            messages: state.messages.map((m) =>
                m._id === messageId ? { ...m, content: data.message.content, isEdited: true, replyTo: data.message.replyTo } : m
            ),
        }));
        return data.message;
    },

    handleMessageEdited: (payload) => set((state) => ({
        messages: state.messages.map((m) =>
            m._id === payload._id ? { ...m, content: payload.content, isEdited: true, replyTo: payload.replyTo } : m
        ),
    })),
}));
