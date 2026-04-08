import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/events');

export const useEventStore = create((set, get) => ({
    events: [],
    isLoading: false,
    error: null,

    fetchEvents: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(API_URL, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch events');

            set({ events: data.events, isLoading: false });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    createEvent: async ({ title, description, date, location, startDate, endDate, coverImage, locationType }) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title, description, date, location, startDate, endDate, coverImage, locationType }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create event');

            // Socket `new_event` will handle the UI push
            set({ isLoading: false });
            return data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    toggleRsvp: async (eventId, userId) => {
        // ── Optimistic update ──
        const prevEvents = get().events;
        set((state) => ({
            events: state.events.map((e) => {
                if (e._id !== eventId) return e;
                const isRsvped = e.rsvpList.includes(userId);
                return {
                    ...e,
                    rsvpList: isRsvped
                        ? e.rsvpList.filter((id) => id !== userId)
                        : [...e.rsvpList, userId],
                };
            }),
        }));

        try {
            const res = await apiFetch(`${API_URL}/${eventId}/rsvp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to toggle RSVP');
            // Socket `rsvp_update` will reconcile the authoritative state
            return data;
        } catch (error) {
            // ── Revert on failure ──
            set({ events: prevEvents, error: error.message });
            throw error;
        }
    },

    deleteEvent: async (eventId) => {
        const prevEvents = get().events;
        set((state) => ({
            events: state.events.filter((e) => e._id !== eventId),
        }));
        try {
            const res = await apiFetch(`${API_URL}/${eventId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete event');
            return data;
        } catch (error) {
            set({ events: prevEvents, error: error.message });
            throw error;
        }
    },

    startEvent: async (eventId) => {
        const res = await apiFetch(`${API_URL}/${eventId}/start`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to start event');
        return data;
    },

    endEvent: async (eventId) => {
        const res = await apiFetch(`${API_URL}/${eventId}/end`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to end event');
        return data;
    },

    updateEvent: async (eventId, payload) => {
        const res = await apiFetch(`${API_URL}/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update event');
        return data;
    },

    getCalendarLinks: async (eventId) => {
        const res = await apiFetch(`${API_URL}/${eventId}/calendar-links`, {
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch calendar links');
        return data.links;
    },

    downloadEventIcs: async (eventId) => {
        const res = await apiFetch(`${API_URL}/${eventId}/calendar.ics`, {
            credentials: 'include',
        });
        if (!res.ok) {
            let message = 'Failed to download event calendar file';
            try {
                const data = await res.json();
                message = data.message || message;
            } catch {
                // ignore parse errors for non-json responses
            }
            throw new Error(message);
        }
        return await res.text();
    },

    setEventReminder: async (eventId, minutesBefore) => {
        const res = await apiFetch(`${API_URL}/${eventId}/reminder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ minutesBefore }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to set reminder');
        set((state) => ({
            events: state.events.map((event) =>
                event._id === eventId
                    ? { ...event, reminderMinutes: data.reminderMinutes }
                    : event
            ),
        }));
        return data;
    },

    // ── Real-time socket event handlers ──────────────────────────────────────
    handleNewEvent: (event) => {
        set((state) => {
            if (state.events.some((e) => e._id === event._id)) return state;
            // Insert in date-sorted order
            const updated = [...state.events, event].sort(
                (a, b) => new Date(a.date) - new Date(b.date)
            );
            return { events: updated };
        });
    },

    handleRsvpUpdate: ({ eventId, rsvpList }) => {
        set((state) => ({
            events: state.events.map((e) =>
                e._id === eventId ? { ...e, rsvpList } : e
            ),
        }));
    },

    handleDeleteEvent: (eventId) => {
        set((state) => ({
            events: state.events.filter((e) => e._id !== eventId),
        }));
    },

    handleUpdateEvent: (event) => {
        set((state) => ({
            events: state.events.map((e) => (e._id === event._id ? event : e)),
        }));
    },

    handleStartEvent: (event) => {
        set((state) => ({
            events: state.events.map((e) => (e._id === event._id ? event : e)),
        }));
    },

    handleEndEvent: (event) => {
        set((state) => ({
            events: state.events.map((e) => (e._id === event._id ? event : e)),
        }));
    },

    clearError: () => set({ error: null }),
}));
