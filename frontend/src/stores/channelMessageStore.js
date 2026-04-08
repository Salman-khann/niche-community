import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/channel-messages');

export const useChannelMessageStore = create((set) => ({
    messages: [],
    isLoading: false,
    isLoadingOlder: false,
    error: null,
    commentsByMessage: {},
    commentsLoading: {},
    commentsPaging: {},
    pinnedMessages: [],
    scrollToMessageId: null,
    hasMoreMessages: false,
    nextBefore: null,

    fetchMessages: async (channelId, limit = 50) => {
        set({ isLoading: true, error: null, messages: [], hasMoreMessages: false, nextBefore: null });
        try {
            const res = await apiFetch(`${API_URL}/${channelId}?limit=${limit}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load messages');
            set({
                messages: data.messages || [],
                hasMoreMessages: Boolean(data.hasMore),
                nextBefore: data.nextBefore || null,
                isLoading: false,
            });
            return data.messages || [];
        } catch (error) {
            set({ isLoading: false, error: error.message || 'Failed to load messages' });
            throw error;
        }
    },

    loadOlderMessages: async (channelId, limit = 50) => {
        const { nextBefore, isLoadingOlder, hasMoreMessages } = useChannelMessageStore.getState();
        if (!channelId || !nextBefore || isLoadingOlder || !hasMoreMessages) return [];

        set({ isLoadingOlder: true, error: null });
        try {
            const encodedBefore = encodeURIComponent(nextBefore);
            const res = await apiFetch(`${API_URL}/${channelId}?limit=${limit}&before=${encodedBefore}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load older messages');

            const older = data.messages || [];
            set((state) => {
                const seen = new Set(state.messages.map((m) => m._id));
                const uniqueOlder = older.filter((m) => !seen.has(m._id));
                return {
                    messages: [...uniqueOlder, ...state.messages],
                    hasMoreMessages: Boolean(data.hasMore),
                    nextBefore: data.nextBefore || null,
                    isLoadingOlder: false,
                };
            });
            return older;
        } catch (error) {
            set({ isLoadingOlder: false, error: error.message || 'Failed to load older messages' });
            throw error;
        }
    },

    clearChannelState: () => set({
        messages: [],
        isLoadingOlder: false,
        commentsByMessage: {},
        commentsLoading: {},
        commentsPaging: {},
        pinnedMessages: [],
        error: null,
        isLoading: false,
        scrollToMessageId: null,
        hasMoreMessages: false,
        nextBefore: null,
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

    fetchComments: async (channelId, messageId, options = {}) => {
        set((state) => ({
            commentsLoading: { ...state.commentsLoading, [messageId]: true },
        }));
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', String(options.limit));
        if (options.before) params.append('before', String(options.before));
        const query = params.toString();

        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/comments${query ? `?${query}` : ''}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load comments');
        set((state) => ({
            commentsByMessage: { ...state.commentsByMessage, [messageId]: data.comments || [] },
            commentsLoading: { ...state.commentsLoading, [messageId]: false },
            commentsPaging: {
                ...state.commentsPaging,
                [messageId]: {
                    hasMore: Boolean(data.hasMore),
                    nextBefore: data.nextBefore || null,
                    isLoadingOlder: false,
                },
            },
        }));
        return data.comments || [];
    },

    loadOlderComments: async (channelId, messageId, limit = 50) => {
        const state = useChannelMessageStore.getState();
        const paging = state.commentsPaging[messageId] || {};
        if (!paging.hasMore || !paging.nextBefore || paging.isLoadingOlder) return [];

        set((s) => ({
            commentsPaging: {
                ...s.commentsPaging,
                [messageId]: {
                    ...(s.commentsPaging[messageId] || {}),
                    isLoadingOlder: true,
                },
            },
        }));

        try {
            const encodedBefore = encodeURIComponent(paging.nextBefore);
            const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/comments?limit=${limit}&before=${encodedBefore}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load older comments');

            const older = data.comments || [];
            set((s) => {
                const existing = s.commentsByMessage[messageId] || [];
                const seen = new Set(existing.map((c) => c._id));
                const uniqueOlder = older.filter((c) => !seen.has(c._id));
                return {
                    commentsByMessage: {
                        ...s.commentsByMessage,
                        [messageId]: [...uniqueOlder, ...existing],
                    },
                    commentsPaging: {
                        ...s.commentsPaging,
                        [messageId]: {
                            hasMore: Boolean(data.hasMore),
                            nextBefore: data.nextBefore || null,
                            isLoadingOlder: false,
                        },
                    },
                };
            });

            return older;
        } catch (error) {
            set((s) => ({
                commentsPaging: {
                    ...s.commentsPaging,
                    [messageId]: {
                        ...(s.commentsPaging[messageId] || {}),
                        isLoadingOlder: false,
                    },
                },
                error: error.message || 'Failed to load older comments',
            }));
            throw error;
        }
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
