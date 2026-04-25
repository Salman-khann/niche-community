import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Users, Ticket, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import InputField from '../components/InputField';
import Button from '../components/Button';
import { useAuthStore } from '../stores/authStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { apiUrl } from '../config/urls';

const API_URL = apiUrl('/api/communities');

const JoinCommunityPage = () => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [autoJoined, setAutoJoined] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const { user, setUser, checkAuth } = useAuthStore();
    const { initFromMemberships } = useWorkspaceStore();

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    const joinWithCode = async (rawCode) => {
        setError('');
        setSuccess(null);

        if (!rawCode.trim()) {
            setError('Please enter an invite code');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ inviteCode: rawCode.trim() }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Failed to join community');

            setSuccess(data);
            setCode('');

            // Update memberships in auth store & workspace
            if (data.user?.memberships) {
                setUser(data.user);
                initFromMemberships(data.user.memberships);
                const membershipsReady = data.user.memberships.every((m) => typeof m.communityId === 'object' && m.communityId?.name);
                if (!membershipsReady) {
                    await checkAuth();
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await joinWithCode(code);
    };

    useEffect(() => {
        const urlCode = searchParams.get('code');
        if (!urlCode) return;
        const normalized = urlCode.trim().toUpperCase();
        setCode(normalized);
        if (autoJoined) return;
        setAutoJoined(true);
        joinWithCode(normalized);
    }, [searchParams, autoJoined]);

    return (
        <div className="min-h-screen min-h-[100dvh] bg-discord-darkest relative overflow-hidden flex flex-col">
            {/* Ambient bg */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-28 -right-24 w-72 h-72 rounded-full bg-blurple/[0.08] blur-[100px]" />
                <div className="absolute bottom-[30%] -left-20 w-56 h-56 rounded-full bg-indigo-600/[0.05] blur-[80px]" />
            </div>

            {/* Header */}
            <header className={`relative z-10 flex items-center justify-between px-5 sm:px-8 py-4
                transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center shadow-lg shadow-blurple/25">
                        <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-white">CircleCore</span>
                </Link>
            </header>

            {/* Main */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10">
                {/* Icon */}
                <div className={`mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-blurple shadow-lg shadow-blurple/30 flex items-center justify-center">
                            <Users className="w-7 h-7 text-white" strokeWidth={2} />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-blurple/20 blur-xl -z-10 animate-pulse-glow" />
                    </div>
                </div>

                {/* Heading */}
                <div className={`text-center mb-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">Join a Community</h1>
                    <p className="text-sm sm:text-base text-discord-muted font-medium">
                        Enter an invite code to join a new community.
                    </p>
                </div>

                {/* Card */}
                <section className={`w-full max-w-[420px] mx-auto transition-all duration-700 delay-300
                    ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="relative bg-discord-darker rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/20 border border-discord-border/50">

                        {/* Success state */}
                        {success && (
                            <div className="mb-5 px-4 py-4 bg-discord-green/10 border border-discord-green/20 rounded-lg text-center animate-scale-in">
                                <CheckCircle className="w-8 h-8 text-discord-green mx-auto mb-2" />
                                <p className="text-sm font-bold text-discord-green mb-1">{success.message}</p>
                                <p className="text-xs text-discord-muted">
                                    You're now a member of <span className="font-semibold text-discord-light">{success.community?.name}</span>
                                </p>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => navigate('/feed')}
                                >
                                    Go to Feed
                                </Button>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="mb-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium text-center animate-shake flex items-center justify-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        {!success && (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <InputField
                                    id="join-invite-code"
                                    label="Invite Code"
                                    type="text"
                                    placeholder="CIRCLE-XXXX-XXXX"
                                    value={code}
                                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
                                    icon={<Ticket className="w-4 h-4" strokeWidth={2} />}
                                    autoFocus
                                />

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    loading={isLoading}
                                    icon={!isLoading && <Users className="w-4 h-4" strokeWidth={2} />}
                                >
                                    {isLoading ? 'Joining…' : 'Join Community'}
                                </Button>
                            </form>
                        )}

                        {/* Info */}
                        <div className="text-center mt-5 space-y-3">
                            <p className="text-xs text-discord-faint">
                                Ask a community admin for an invite code if you don't have one.
                            </p>
                            <div className="pt-3 border-t border-discord-border/30">
                                <p className="text-xs text-discord-faint mb-2">Or find a community to join</p>
                                <button
                                    onClick={() => navigate('/feed?openDirectory=true')}
                                    className="text-xs font-semibold text-blurple hover:text-blurple-hover transition-colors flex items-center justify-center gap-1 mx-auto"
                                >
                                    Browse Server Directory <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Back link */}
                    <div className={`text-center mt-6 transition-all duration-500 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                        <button
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-1.5 text-sm text-discord-muted hover:text-white transition-colors font-medium cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default JoinCommunityPage;
