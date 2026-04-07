import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/posts');
const UPLOAD_URL = apiUrl('/api/upload');

export const useFeedStore = create((set, get) => ({
    posts: [],
    currentPage: 1,
    totalPages: 1,
    totalPosts: 0,
    activeTag: null,
    isLoading: false,
    error: null,

    fetchFeed: async (page = 1, tag = null, channelId = null) => {
        set({ isLoading: true, error: null });
        try {
            const params = new URLSearchParams({ page, limit: 10 });
            if (tag) params.append('tag', tag);
            if (channelId) params.append('channelId', channelId);

            const res = await apiFetch(`${API_URL}/feed?${params}`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch feed');

            set({
                posts: data.posts,
                currentPage: data.currentPage,
                totalPages: data.totalPages,
                totalPosts: data.totalPosts,
                activeTag: tag,
                isLoading: false,
            });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // ── Upload a file to Cloudinary via backend ──────────────────────────────
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await apiFetch(UPLOAD_URL, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        return data.url; // Cloudinary secure_url
    },

    createPost: async ({ content, tags, mediaURLs, resourceLinks, poll, channelId, mentions }) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content, tags, mediaURLs, resourceLinks, poll, channelId, mentions }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create post');

            // Prepend the new post to local state immediately so it appears in the feed.
            // handleNewPost (socket) has dedup logic, so no duplicates if the event also fires.
            if (data.post) {
                set((state) => {
                    if (state.posts.some((p) => p._id === data.post._id)) return { isLoading: false };
                    return {
                        posts: [data.post, ...state.posts],
                        totalPosts: state.totalPosts + 1,
                        isLoading: false,
                    };
                });
            } else {
                set({ isLoading: false });
            }
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    reactToPost: async (postId) => {
        try {
            const res = await apiFetch(`${API_URL}/${postId}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to react');
            // Socket event will update the UI
            return data;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    addComment: async (postId, content, mentions = []) => {
        try {
            const res = await apiFetch(`${API_URL}/${postId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content, mentions }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add comment');
            // Socket event will update the comments count
            return data;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    fetchComments: async (postId) => {
        try {
            const res = await apiFetch(`${API_URL}/${postId}/comments`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch comments');
            return data.comments;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    // ── Vote on Poll ─────────────────────────────────────────────────────────
    voteOnPoll: async (postId, optionIndex) => {
        // Optimistic update
        const userId = null; // Will be updated by socket event
        try {
            const res = await apiFetch(`${API_URL}/${postId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ optionIndex }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to vote');
            return data;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    // ── Real-time socket event handlers ──────────────────────────────────────
    handleNewPost: (post) => {
        set((state) => {
            // Avoid duplicates
            if (state.posts.some((p) => p._id === post._id)) return state;
            return {
                posts: [post, ...state.posts],
                totalPosts: state.totalPosts + 1,
            };
        });
    },

    handleNewReaction: ({ postId, likesCount, likedBy }) => {
        set((state) => ({
            posts: state.posts.map((p) =>
                p._id === postId ? { ...p, likesCount, likedBy } : p
            ),
        }));
    },

    handleNewComment: ({ postId, commentsCount }) => {
        set((state) => ({
            posts: state.posts.map((p) =>
                p._id === postId ? { ...p, commentsCount } : p
            ),
        }));
    },

    handlePollVote: ({ postId, poll }) => {
        set((state) => ({
            posts: state.posts.map((p) =>
                p._id === postId ? { ...p, poll } : p
            ),
        }));
    },

    flagPost: async (postId, reason = '') => {
        try {
            const res = await apiFetch(apiUrl('/api/moderate/flag'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ postId, reason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to flag post');
            return data;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    // ── Search members for @mention autocomplete ──────────────────────────────
    searchMembers: async (communityId, query) => {
        try {
            const res = await apiFetch(
                apiUrl(`/api/communities/${communityId}/members/search?q=${encodeURIComponent(query)}`),
                { credentials: 'include' }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to search members');
            return data.members || [];
        } catch {
            return [];
        }
    },

    // ── Toggle save/unsave post (bookmark) ─────────────────────────────────────
    toggleSavePost: async (postId) => {
        try {
            const res = await apiFetch(`${API_URL}/${postId}/save`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save post');
            return data;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    // ── Fetch saved posts ────────────────────────────────────────────────────
    fetchSavedPosts: async () => {
        try {
            const res = await apiFetch(`${API_URL}/saved`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch saved posts');
            return data.posts || [];
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
}));
