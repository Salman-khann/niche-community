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
    searchResults: [],
    searchLoading: false,
    searchError: null,
    searchHasMore: false,
    searchNextBeforeId: null,
    lastSearchQuery: '',

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
        searchResults: [],
        searchLoading: false,
        searchError: null,
        searchHasMore: false,
        searchNextBeforeId: null,
        lastSearchQuery: '',
    }),

    clearSearch: () => set({
        searchResults: [],
        searchLoading: false,
        searchError: null,
        searchHasMore: false,
        searchNextBeforeId: null,
        lastSearchQuery: '',
    }),

    searchMessages: async (channelId, query, options = {}) => {
        const trimmed = String(query || '').trim();
        const limit = Math.min(50, Math.max(5, parseInt(options.limit, 10) || 20));
        const reset = options.reset !== false;

        if (!channelId || !trimmed) {
            set({
                searchResults: [],
                searchLoading: false,
                searchError: null,
                searchHasMore: false,
                searchNextBeforeId: null,
                lastSearchQuery: '',
            });
            return [];
        }

        const state = useChannelMessageStore.getState();
        const beforeId = reset ? null : (options.beforeId || state.searchNextBeforeId || null);

        set((s) => ({
            searchLoading: true,
            searchError: null,
            ...(reset ? { searchResults: [], searchHasMore: false, searchNextBeforeId: null } : {}),
            lastSearchQuery: trimmed,
        }));

        try {
            const params = new URLSearchParams();
            params.set('q', trimmed);
            params.set('limit', String(limit));
            if (beforeId) params.set('beforeId', String(beforeId));

            const res = await apiFetch(`${API_URL}/${channelId}/search?${params.toString()}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to search messages');

            const incoming = data.results || [];
            set((s) => {
                if (reset) {
                    return {
                        searchResults: incoming,
                        searchLoading: false,
                        searchError: null,
                        searchHasMore: Boolean(data.hasMore),
                        searchNextBeforeId: data.nextBeforeId || null,
                        lastSearchQuery: trimmed,
                    };
                }

                const seen = new Set((s.searchResults || []).map((row) => row._id));
                const uniqueIncoming = incoming.filter((row) => !seen.has(row._id));
                return {
                    searchResults: [...(s.searchResults || []), ...uniqueIncoming],
                    searchLoading: false,
                    searchError: null,
                    searchHasMore: Boolean(data.hasMore),
                    searchNextBeforeId: data.nextBeforeId || null,
                    lastSearchQuery: trimmed,
                };
            });

            return incoming;
        } catch (error) {
            set({
                searchLoading: false,
                searchError: error.message || 'Failed to search messages',
            });
            throw error;
        }
    },

    loadMoreSearchResults: async (channelId, limit = 20) => {
        const state = useChannelMessageStore.getState();
        if (!channelId || !state.lastSearchQuery || !state.searchHasMore || state.searchLoading) return [];
        return state.searchMessages(channelId, state.lastSearchQuery, {
            reset: false,
            beforeId: state.searchNextBeforeId,
            limit,
        });
    },

    jumpToMessage: async (channelId, messageId) => {
        if (!channelId || !messageId) return false;

        let state = useChannelMessageStore.getState();
        if (state.messages.some((m) => m._id === messageId)) {
            set({ scrollToMessageId: messageId });
            return true;
        }

        if (state.messages.length === 0) {
            try {
                await state.fetchMessages(channelId, 50);
            } catch {
                return false;
            }
            state = useChannelMessageStore.getState();
            if (state.messages.some((m) => m._id === messageId)) {
                set({ scrollToMessageId: messageId });
                return true;
            }
        }

        let guard = 0;
        while (guard < 40) {
            state = useChannelMessageStore.getState();
            if (state.messages.some((m) => m._id === messageId)) {
                set({ scrollToMessageId: messageId });
                return true;
            }
            if (!state.hasMoreMessages || !state.nextBefore || state.isLoadingOlder) break;
            const older = await state.loadOlderMessages(channelId, 50);
            if (!older || older.length === 0) break;
            guard += 1;
        }

        state = useChannelMessageStore.getState();
        if (state.messages.some((m) => m._id === messageId)) {
            set({ scrollToMessageId: messageId });
            return true;
        }
        return false;
    },

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

    toggleReaction: async (channelId, messageId, emoji = '❤️') => {
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ emoji }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to react');
        set((state) => ({
            messages: state.messages.map((m) =>
                m._id === messageId
                    ? { ...m, likesCount: data.likesCount, likedBy: data.likedBy, reactions: data.reactions || m.reactions || [] }
                    : m
            ),
        }));
        return data;
    },

    handleReaction: (payload) => set((state) => ({
        messages: state.messages.map((m) =>
            m._id === payload.messageId
                ? { ...m, likesCount: payload.likesCount, likedBy: payload.likedBy, reactions: payload.reactions || m.reactions || [] }
                : m
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

    deleteMessage: async (channelId, messageId) => {
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to delete message');
        set((state) => ({
            messages: state.messages.filter((m) => m._id !== messageId),
            pinnedMessages: state.pinnedMessages.filter((p) => p._id !== messageId),
        }));
        return data;
    },

    handleMessageDeleted: (payload) => set((state) => ({
        messages: state.messages.filter((m) => m._id !== payload.messageId),
        pinnedMessages: state.pinnedMessages.filter((p) => p._id !== payload.messageId),
    })),

    editMessage: async (channelId, messageId, content) => {
        const res = await apiFetch(`${API_URL}/${channelId}/${messageId}`, {
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

    setScrollTarget: (messageId) => set({ scrollToMessageId: messageId }),
}));
