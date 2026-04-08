import { create } from 'zustand';
import { apiFetch } from './apiFetch';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/billing');

export const useBillingStore = create((set) => ({
    isLoading: false,
    error: null,
    subscription: null,
    invoices: [],

    createCheckoutSession: async (plan = 'premium') => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ plan }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create checkout session');
            set({ isLoading: false });
            return data;
        } catch (error) {
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    fetchSubscriptionStatus: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/subscription`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch subscription');
            set({ isLoading: false, subscription: data.subscription || null });
            return data;
        } catch (error) {
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    fetchInvoices: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/invoices`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch invoices');
            set({ isLoading: false, invoices: data.invoices || [] });
            return data;
        } catch (error) {
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    setAutoRenewal: async (enabled) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/auto-renewal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update auto-renewal');
            set((state) => ({
                isLoading: false,
                subscription: state.subscription
                    ? {
                        ...state.subscription,
                        ...data.subscription,
                        subscriptionStatus: data.subscription?.subscriptionStatus || state.subscription.subscriptionStatus,
                    }
                    : data.subscription || null,
            }));
            return data;
        } catch (error) {
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    createPortalSession: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`${API_URL}/portal-session`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to open billing portal');
            set({ isLoading: false });
            return data;
        } catch (error) {
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
}));
