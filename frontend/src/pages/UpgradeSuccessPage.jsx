import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Button from '../components/Button';
import { useAuthStore } from '../stores/authStore';
import { useProfileStore } from '../stores/profileStore';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/billing');

const safeReadJson = async (response) => {
    if (!response) return {};
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const bodyText = await response.text();
    if (!bodyText) return {};
    if (!contentType.includes('application/json')) return { message: bodyText };
    try {
        return JSON.parse(bodyText);
    } catch {
        return { message: bodyText };
    }
};

const UpgradeSuccessPage = () => {
    const { user } = useAuthStore();
    const { fetchProfile } = useProfileStore();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying'); // verifying | success | error
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        let cancelled = false;
        const sessionId = searchParams.get('session_id');

        const verify = async () => {
            try {
                if (!sessionId) throw new Error('No session ID found in URL');

                // Call backend to verify the Stripe session and activate premium
                const res = await fetch(`${API_URL}/verify-session?session_id=${sessionId}`, {
                    credentials: 'include',
                });
                const data = await safeReadJson(res);
                if (!res.ok) throw new Error(data.message || 'Verification failed');

                // Refresh profile to pick up the updated tier
                if (user?._id) await fetchProfile(user._id);

                if (!cancelled) setStatus('success');
            } catch (err) {
                console.error('Session verification failed:', err);
                if (!cancelled) {
                    setErrorMsg(err.message || 'Something went wrong');
                    setStatus('error');
                }
            }
        };

        // Small delay to allow Stripe to finalize the session
        const timer = setTimeout(verify, 1000);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [searchParams, user?._id, fetchProfile]);

    if (status === 'verifying') {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-discord-darkest flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-discord-darker border border-discord-border/50 rounded-3xl p-8 text-center shadow-xl">
                    <Loader2 className="w-10 h-10 text-discord-blurple mx-auto mb-4 animate-spin" />
                    <h1 className="text-xl font-bold text-white mb-2">Confirming your subscription…</h1>
                    <p className="text-sm text-discord-muted">This will only take a moment.</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-discord-darkest flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-discord-darker border border-discord-border/50 rounded-3xl p-8 text-center shadow-xl">
                    <AlertCircle className="w-12 h-12 text-discord-red mx-auto mb-3" />
                    <h1 className="text-2xl font-black text-white mb-2">Verification Failed</h1>
                    <p className="text-sm text-discord-muted mb-6">{errorMsg}</p>
                    <div className="flex flex-col gap-2">
                        <Link to="/upgrade"><Button variant="primary" fullWidth>Try Again</Button></Link>
                        <Link to="/feed"><Button variant="ghost" fullWidth>Back to Feed</Button></Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-[100dvh] bg-discord-darkest flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-discord-darker border border-discord-border/50 rounded-3xl p-8 text-center shadow-xl">
                <CheckCircle2 className="w-12 h-12 text-discord-green mx-auto mb-3" />
                <h1 className="text-2xl font-black text-white mb-2">Subscription Confirmed</h1>
                <p className="text-sm text-discord-muted mb-6">Your Premium plan is active. You now have access to all premium channels.</p>
                <div className="flex flex-col gap-2">
                    <Link to="/feed"><Button variant="primary" fullWidth>Go to Feed</Button></Link>
                    <Link to="/feed"><Button variant="ghost" fullWidth>Back to Feed</Button></Link>
                </div>
            </div>
        </div>
    );
};

export default UpgradeSuccessPage;
