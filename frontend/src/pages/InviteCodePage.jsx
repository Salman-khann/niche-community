import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Sparkles, Ticket, ArrowRight, ShieldCheck, Plus, Building2, Globe, FileText } from 'lucide-react';
import InputField from '../components/InputField';
import Button from '../components/Button';
import { useInviteStore } from '../stores/inviteStore';
import { useCommunityStore } from '../stores/communityStore';
import { useAuthStore } from '../stores/authStore';

const InviteCodePage = () => {
    const [code, setCode] = useState('');
    const [fieldError, setFieldError] = useState('');
    const [mounted, setMounted] = useState(false);
    const [success, setSuccess] = useState(false);
    const [mode, setMode] = useState('invite');
    const navigate = useNavigate();

    const [wsName, setWsName] = useState('');
    const [wsDesc, setWsDesc] = useState('');
    const [wsSlug, setWsSlug] = useState('');
    const [wsErrors, setWsErrors] = useState({});
    const [searchParams] = useSearchParams();
    const oauthError = searchParams.get('oauth_error');

    const getOauthErrorMessage = (value) => {
        if (!value) return '';

        const normalized = value.trim();
        const knownErrors = {
            invite_required: 'Apple or LinkedIn sign-in needs an invite code. Enter one below to continue.',
            linkedin_oauth_missing_code: 'LinkedIn sign-in was cancelled or did not return a code. Please try again.',
            linkedin_email_unavailable: 'LinkedIn did not provide an email address. Use another sign-in method or LinkedIn account email visibility settings.',
            apple_oauth_missing_code: 'Apple sign-in was cancelled or did not return a code. Please try again.',
            apple_email_unavailable: 'Apple did not provide an email address for this account.',
        };

        if (knownErrors[normalized]) return knownErrors[normalized];

        // Show provider messages as-is for unknown failures so users can act on them.
        return normalized;
    };

    const { validateInviteCode, isLoading, error, clearError } = useInviteStore();
    const { createCommunity, isLoading: wsLoading, error: wsError, clearError: clearWsError } = useCommunityStore();
    const { user, checkAuth } = useAuthStore();

    const canCreateWorkspace = !!user;

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => { clearError(); clearWsError(); }, []);

    useEffect(() => {
        if (wsName) {
            setWsSlug(wsName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
        } else setWsSlug('');
    }, [wsName]);

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        setFieldError('');
        if (!code.trim()) { setFieldError('Please enter your invite code'); return; }
        try {
            await validateInviteCode(code.trim());
            setSuccess(true);
            setTimeout(() => navigate('/signup'), 1200);
        } catch { /* error set in store */ }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        const errs = {};
        if (!wsName.trim()) errs.name = 'Community name is required';
        if (wsName.trim().length < 3) errs.name = 'Name must be at least 3 characters';
        setWsErrors(errs);
        if (Object.keys(errs).length > 0) return;
        try {
            await createCommunity(wsName.trim(), wsDesc.trim(), wsSlug.trim());
            await checkAuth();
            setSuccess(true);
            setTimeout(() => navigate('/feed'), 1200);
        } catch { /* error in store */ }
    };

    return (
        <div className="min-h-screen min-h-[100dvh] bg-discord-darkest relative overflow-hidden flex flex-col">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-28 -left-24 w-72 h-72 rounded-full bg-blurple/[0.08] blur-[100px]" />
                <div className="absolute bottom-[20%] -right-20 w-56 h-56 rounded-full bg-indigo-600/[0.05] blur-[80px]" />
            </div>

            <header className={`relative z-10 flex items-center justify-between px-5 sm:px-8 py-4
                transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center shadow-lg shadow-blurple/25">
                        <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-white">CircleCore</span>
                </Link>
                <Link to="/login" className="text-sm font-medium text-discord-muted hover:text-white transition-colors">
                    Already a member? Log in
                </Link>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10">
                <div className={`mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-blurple shadow-lg shadow-blurple/30 flex items-center justify-center">
                            {success
                                ? <ShieldCheck className="w-7 h-7 text-white" strokeWidth={2} />
                                : mode === 'create'
                                    ? <Building2 className="w-7 h-7 text-white" strokeWidth={2} />
                                    : <Ticket className="w-7 h-7 text-white" strokeWidth={2} />
                            }
                        </div>
                        <div className="absolute inset-0 rounded-full bg-blurple/20 blur-xl -z-10 animate-pulse-glow" />
                    </div>
                </div>

                <div className={`text-center mb-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
                        {success
                            ? (mode === 'create' ? 'Workspace Created!' : "You're in!")
                            : mode === 'create'
                                ? 'Create Your Workspace'
                                : 'Got an invite?'
                        }
                    </h1>
                    <p className="text-sm sm:text-base text-discord-muted font-medium max-w-sm mx-auto">
                        {success
                            ? (mode === 'create'
                                ? 'Your community is ready. Redirecting to feed…'
                                : 'Code verified! Redirecting you to create your account…')
                            : mode === 'create'
                                ? 'Set up your community and become its admin.'
                                : 'CircleCore is invite-only. Enter your code to get started.'
                        }
                    </p>
                </div>

                {/* Invite Card */}
                {!success && mode === 'invite' && (
                    <section className={`w-full max-w-[420px] mx-auto transition-all duration-700 delay-300
                        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="relative bg-discord-darker rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/20 border border-discord-border/50">
                            {oauthError && (
                                <div className="mb-5 px-4 py-3 bg-discord-yellow/10 border border-discord-yellow/20 rounded-lg text-sm text-discord-yellow font-medium text-center">
                                    {getOauthErrorMessage(oauthError)}
                                </div>
                            )}

                            {error && (
                                <div className="mb-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium text-center animate-shake">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleInviteSubmit} className="space-y-4">
                                <InputField id="invite-code" label="Invite Code" type="text"
                                    placeholder="e.g. CIRCLE-XXXX-XXXX" value={code}
                                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setFieldError(''); clearError(); }}
                                    error={fieldError} icon={<Ticket className="w-4 h-4" strokeWidth={2} />} autoComplete="off" />

                                <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading}
                                    icon={!isLoading && <ArrowRight className="w-4 h-4" strokeWidth={2} />}>
                                    {isLoading ? 'Validating…' : 'Continue'}
                                </Button>
                            </form>

                            {canCreateWorkspace && (
                                <>
                                    <div className="relative flex items-center gap-3 my-6">
                                        <div className="flex-1 h-px bg-discord-border" />
                                        <span className="text-[11px] text-discord-faint font-medium uppercase tracking-wider">or</span>
                                        <div className="flex-1 h-px bg-discord-border" />
                                    </div>

                                    <Button variant="secondary" fullWidth
                                        onClick={() => { setMode('create'); clearError(); }}
                                        icon={<Plus className="w-4 h-4" strokeWidth={2} />}>
                                        Create a New Workspace
                                    </Button>
                                </>
                            )}

                            <p className="mt-5 text-xs text-center text-discord-faint font-medium leading-relaxed">
                                {canCreateWorkspace
                                    ? "Don't have a code? Create your own community instead."
                                    : "Don't have a code? Ask a current member or check your email for an invitation."
                                }
                            </p>
                        </div>
                    </section>
                )}

                {/* Create Workspace Card */}
                {!success && mode === 'create' && canCreateWorkspace && (
                    <section className={`w-full max-w-[420px] mx-auto transition-all duration-700 delay-300
                        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="relative bg-discord-darker rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/20 border border-discord-border/50">
                            {wsError && (
                                <div className="mb-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium text-center animate-shake">
                                    {wsError}
                                </div>
                            )}

                            <form onSubmit={handleCreateSubmit} className="space-y-4">
                                <InputField id="ws-name" label="Community Name" type="text"
                                    placeholder="e.g. Design Guild" value={wsName}
                                    onChange={(e) => { setWsName(e.target.value); setWsErrors((p) => ({ ...p, name: '' })); clearWsError(); }}
                                    error={wsErrors.name} icon={<Building2 className="w-4 h-4" strokeWidth={2} />} />

                                <InputField id="ws-slug" label="Slug (URL-friendly)" type="text"
                                    placeholder="auto-generated-from-name" value={wsSlug}
                                    onChange={(e) => setWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    icon={<Globe className="w-4 h-4" strokeWidth={2} />} />

                                <InputField id="ws-desc" label="Description (optional)" type="text"
                                    placeholder="What's this community about?" value={wsDesc}
                                    onChange={(e) => setWsDesc(e.target.value)}
                                    icon={<FileText className="w-4 h-4" strokeWidth={2} />} />

                                <Button type="submit" variant="primary" size="lg" fullWidth loading={wsLoading}
                                    icon={!wsLoading && <ArrowRight className="w-4 h-4" strokeWidth={2} />}>
                                    {wsLoading ? 'Creating…' : 'Create Workspace'}
                                </Button>
                            </form>

                            <div className="relative flex items-center gap-3 my-6">
                                <div className="flex-1 h-px bg-discord-border" />
                                <span className="text-[11px] text-discord-faint font-medium uppercase tracking-wider">or</span>
                                <div className="flex-1 h-px bg-discord-border" />
                            </div>

                            <Button variant="secondary" fullWidth
                                onClick={() => { setMode('invite'); clearWsError(); }}
                                icon={<Ticket className="w-4 h-4" strokeWidth={2} />}>
                                I Have an Invite Code
                            </Button>
                        </div>
                    </section>
                )}

                {success && (
                    <div className="animate-scale-in">
                        <div className="w-12 h-12 rounded-full bg-discord-green/10 flex items-center justify-center mx-auto">
                            <ShieldCheck className="w-6 h-6 text-discord-green" strokeWidth={2} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default InviteCodePage;
