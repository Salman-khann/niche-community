import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/channel-messages');

export const useChannelMessageStore = create((set) => ({
    messages: [],
    isLoading: false,
    error: null,
    commentsByMessage: {},
    commentsLoading: {},
    pinnedMessages: [],
    scrollToMessageId: null,

    fetchMessages: async (channelId) => {
        set({ isLoading: true, error: null, messages: [] });
        try {
            const res = await apiFetch(`${API_URL}/${channelId}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load messages');
            set({ messages: data.messages || [], isLoading: false });
            return data.messages || [];
        } catch (error) {
            set({ isLoading: false, error: error.message || 'Failed to load messages' });
            throw error;
        }
    },

    clearChannelState: () => set({
        messages: [],
        commentsByMessage: {},
        commentsLoading: {},
        pinnedMessages: [],
        error: null,
        isLoading: false,
        scrollToMessageId: null,
    }),

    sendMessage: async (channelId, payload) => {
        const res = await apiFetch(`${API_URL}/${channelId}`, {
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

    fetchPinned: async (channelId) => {
        const res = await apiFetch(`${API_URL}/${channelId}/pins`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch pins');
        set({ pinnedMessages: data.messages || [] });
        return data.messages || [];
    },

    togglePin: async (channelId, messageId) => {
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/pin`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to pin message');
        set((state) => {
            const updatedMessages = state.messages.map((m) =>
                m._id === messageId ? { ...m, pinnedBy: data.pinnedBy } : m
            );
            const updatedPinned = data.pinnedBy?.length
                ? (() => {
                    const msg = updatedMessages.find((m) => m._id === messageId);
                    if (!msg) return state.pinnedMessages;
                    if (state.pinnedMessages.some((p) => p._id === messageId)) return state.pinnedMessages;
                    return [msg, ...state.pinnedMessages];
                })()
                : state.pinnedMessages.filter((p) => p._id !== messageId);
            return { messages: updatedMessages, pinnedMessages: updatedPinned };
        });
        return data;
    },

    toggleReaction: async (channelId, messageId) => {
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to react');
        set((state) => ({
            messages: state.messages.map((m) =>
                m._id === messageId ? { ...m, likesCount: data.likesCount, likedBy: data.likedBy } : m
            ),
        }));
        return data;
    },

    handleReaction: (payload) => set((state) => ({
        messages: state.messages.map((m) =>
            m._id === payload.messageId ? { ...m, likesCount: payload.likesCount, likedBy: payload.likedBy } : m
        ),
    })),

    fetchComments: async (channelId, messageId) => {
        set((state) => ({
            commentsLoading: { ...state.commentsLoading, [messageId]: true },
        }));
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/comments`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load comments');
        set((state) => ({
            commentsByMessage: { ...state.commentsByMessage, [messageId]: data.comments || [] },
            commentsLoading: { ...state.commentsLoading, [messageId]: false },
        }));
        return data.comments || [];
    },

    addComment: async (channelId, messageId, content, mentions = []) => {
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content, mentions }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to add comment');
        set((state) => {
            const existing = state.commentsByMessage[messageId] || [];
            if (existing.some((c) => c._id === data.comment._id)) {
                return {
                    messages: state.messages.map((m) =>
                        m._id === messageId ? { ...m, commentsCount: data.commentsCount } : m
                    ),
                };
            }
            return {
                commentsByMessage: {
                    ...state.commentsByMessage,
                    [messageId]: [...existing, data.comment],
                },
                messages: state.messages.map((m) =>
                    m._id === messageId ? { ...m, commentsCount: data.commentsCount } : m
                ),
            };
        });
        return data.comment;
    },

    reactToComment: async (channelId, messageId, commentId, emoji) => {
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/comments/${commentId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ emoji }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to react to comment');

        set((state) => {
            const existing = state.commentsByMessage[messageId] || [];
            return {
                commentsByMessage: {
                    ...state.commentsByMessage,
                    [messageId]: existing.map((c) =>
                        c._id === commentId ? { ...c, reactions: data.reactions || [] } : c
                    ),
                },
            };
        });
        return data;
    },

    handleComment: ({ messageId, comment, commentsCount }) => set((state) => {
        const existing = state.commentsByMessage[messageId] || [];
        if (existing.some((c) => c._id === comment._id)) {
            return {
                messages: state.messages.map((m) =>
                    m._id === messageId ? { ...m, commentsCount } : m
                ),
            };
        }
        return {
            commentsByMessage: {
                ...state.commentsByMessage,
                [messageId]: [...existing, comment],
            },
            messages: state.messages.map((m) =>
                m._id === messageId ? { ...m, commentsCount } : m
            ),
        };
    }),

    handleCommentReaction: ({ messageId, commentId, reactions }) => set((state) => {
        const existing = state.commentsByMessage[messageId] || [];
        return {
            commentsByMessage: {
                ...state.commentsByMessage,
                [messageId]: existing.map((c) =>
                    c._id === commentId ? { ...c, reactions: reactions || [] } : c
                ),
            },
        };
    }),

    handlePin: ({ messageId, pinnedBy }) => set((state) => {
        const updatedMessages = state.messages.map((m) =>
            m._id === messageId ? { ...m, pinnedBy } : m
        );
        const updatedPinned = (pinnedBy?.length ?? 0) > 0
            ? (() => {
                const msg = updatedMessages.find((m) => m._id === messageId);
                if (!msg) return state.pinnedMessages;
                if (state.pinnedMessages.some((p) => p._id === messageId)) return state.pinnedMessages;
                return [msg, ...state.pinnedMessages];
            })()
            : state.pinnedMessages.filter((p) => p._id !== messageId);
        return { messages: updatedMessages, pinnedMessages: updatedPinned };
    }),

    setScrollTarget: (messageId) => set({ scrollToMessageId: messageId }),
}));
