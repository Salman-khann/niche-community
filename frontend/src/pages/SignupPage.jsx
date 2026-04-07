import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, Sparkles, UserPlus } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import { SiApple } from 'react-icons/si';
import { FaLinkedinIn } from 'react-icons/fa';
import InputField from '../components/InputField';
import Button from '../components/Button';
import CursorFollower from '../components/CursorFollower';
import { useAuthStore } from '../stores/authStore';
import { useInviteStore } from '../stores/inviteStore';

const SignupPage = () => {
    const [searchParams] = useSearchParams();
    const codeFromUrl = searchParams.get('code');
    const inviteCode = sessionStorage.getItem('circlecore_invite_code') || '';

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [mounted, setMounted] = useState(false);
    const [autoValidating, setAutoValidating] = useState(false);
    const [formStartedAt] = useState(() => Date.now());
    const [botField, setBotField] = useState('');
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaError, setCaptchaError] = useState('');
    const navigate = useNavigate();
    const recaptchaSiteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();

    const { signup, googleLogin, startAppleLogin, startLinkedInLogin, isLoading, error, clearError } = useAuthStore();
    const { validateInviteCode } = useInviteStore();
    const [googleLoading, setGoogleLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => { clearError(); }, []);

    useEffect(() => {
        if (codeFromUrl && !inviteCode) {
            setAutoValidating(true);
            validateInviteCode(codeFromUrl.trim().toUpperCase())
                .catch(() => navigate('/invite', { replace: true }))
                .finally(() => setAutoValidating(false));
        }
    }, [codeFromUrl]);

    const validate = () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Name is required';
        if (!email.trim()) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
        if (!password) errs.password = 'Password is required';
        else if (password.length < 6) errs.password = 'Must be at least 6 characters';
        if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
        else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    useEffect(() => {
        if (!inviteCode && !codeFromUrl) navigate('/invite', { replace: true });
    }, [inviteCode, codeFromUrl, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        if (recaptchaSiteKey && !captchaToken) {
            setCaptchaError('Please complete the reCAPTCHA check');
            return;
        }
        try {
            await signup(name, email, password, inviteCode, {
                formStartedAt,
                website: botField,
            }, captchaToken);
            sessionStorage.removeItem('circlecore_invite_code');
            navigate('/verify-email');
        } catch { /* error is set in store */ }
    };

    const getStrength = (pw) => {
        if (!pw) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 10) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-discord-red' };
        if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-discord-yellow' };
        if (score <= 3) return { level: 3, label: 'Good', color: 'bg-blurple' };
        return { level: 4, label: 'Strong', color: 'bg-discord-green' };
    };

    const strength = getStrength(password);

    return (
        <div className="min-h-screen min-h-[100dvh] bg-discord-darkest relative overflow-hidden flex flex-col">
            <CursorFollower />
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
                <Link to="/login" className="text-sm font-medium text-discord-muted hover:text-white transition-colors">
                    Log In
                </Link>
            </header>

            {/* Main */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10">
                {/* Icon */}
                <div className={`mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-blurple shadow-lg shadow-blurple/30 flex items-center justify-center">
                            <UserPlus className="w-7 h-7 text-white" strokeWidth={2} />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-blurple/20 blur-xl -z-10 animate-pulse-glow" />
                    </div>
                </div>

                {/* Heading */}
                <div className={`text-center mb-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">Create your account</h1>
                    <p className="text-sm sm:text-base text-discord-muted font-medium">
                        {inviteCode
                            ? <>Invite code <span className="font-bold text-blurple">{inviteCode}</span> verified.</>
                            : 'Set up your CircleCore profile.'}
                    </p>
                </div>

                {/* Card */}
                <section className={`w-full max-w-[420px] mx-auto transition-all duration-700 delay-300
                    ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="relative bg-discord-darker rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/20 border border-discord-border/50">
                        {error && (
                            <div className="mb-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium text-center animate-shake">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="hidden" aria-hidden="true">
                                <label htmlFor="website">Website</label>
                                <input
                                    id="website"
                                    type="text"
                                    value={botField}
                                    onChange={(e) => setBotField(e.target.value)}
                                    tabIndex={-1}
                                    autoComplete="off"
                                />
                            </div>

                            <InputField id="signup-name" label="Full Name" type="text" placeholder="John Doe"
                                value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }}
                                error={errors.name} icon={<User className="w-4 h-4" strokeWidth={2} />} />

                            <InputField id="signup-email" label="Email" type="email" placeholder="you@example.com"
                                value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                                error={errors.email} icon={<Mail className="w-4 h-4" strokeWidth={2} />} />

                            <div>
                                <InputField id="signup-password" label="Password" type="password" placeholder="••••••••"
                                    value={password} onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                                    error={errors.password} icon={<Lock className="w-4 h-4" strokeWidth={2} />} />
                                {password && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex-1 flex gap-1">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div key={i}
                                                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.level ? strength.color : 'bg-discord-border'}`} />
                                            ))}
                                        </div>
                                        <span className="text-[11px] font-semibold text-discord-muted">{strength.label}</span>
                                    </div>
                                )}
                            </div>

                            <InputField id="signup-confirm-password" label="Confirm Password" type="password" placeholder="••••••••"
                                value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: '' })); }}
                                error={errors.confirmPassword} icon={<Lock className="w-4 h-4" strokeWidth={2} />} />

                            <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading}
                                icon={!isLoading && <UserPlus className="w-4 h-4" strokeWidth={2} />}>
                                {isLoading ? 'Creating account…' : 'Create Account'}
                            </Button>

                            {recaptchaSiteKey && (
                                <div className="space-y-2">
                                    <div className="flex justify-center">
                                        <ReCAPTCHA
                                            sitekey={recaptchaSiteKey}
                                            onChange={(token) => {
                                                setCaptchaToken(token || '');
                                                setCaptchaError('');
                                            }}
                                        />
                                    </div>
                                    {captchaError && <p className="text-xs text-discord-red text-center">{captchaError}</p>}
                                </div>
                            )}
                        </form>

                        <div className="relative flex items-center gap-3 my-5">
                            <div className="flex-1 h-px bg-discord-border" />
                            <span className="text-[11px] text-discord-faint font-medium uppercase tracking-wider">or</span>
                            <div className="flex-1 h-px bg-discord-border" />
                        </div>

                        <div className="flex justify-center [&>div]:w-full">
                            <GoogleLogin
                                onSuccess={async (credentialResponse) => {
                                    setGoogleLoading(true);
                                    try {
                                        await googleLogin(credentialResponse.credential, inviteCode);
                                        sessionStorage.removeItem('circlecore_invite_code');
                                        navigate('/onboarding');
                                    } catch { /* error handled in store */ }
                                    setGoogleLoading(false);
                                }}
                                onError={() => {
                                    useAuthStore.getState().clearError();
                                }}
                                theme="filled_black"
                                size="large"
                                width="100%"
                                text="continue_with"
                                shape="rectangular"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <Button
                                type="button"
                                variant="secondary"
                                className="bg-[#1d1d1f] border-[#3a3a3c] text-white hover:bg-[#2a2a2d]"
                                onClick={() => startAppleLogin(inviteCode, 'signup')}
                                icon={<SiApple className="w-4 h-4" />}
                                fullWidth
                            >
                                Apple
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="bg-[#0A66C2] border-[#0A66C2] text-white hover:bg-[#0959ac] hover:border-[#0959ac]"
                                onClick={() => startLinkedInLogin(inviteCode, 'signup')}
                                icon={<FaLinkedinIn className="w-4 h-4" />}
                                fullWidth
                            >
                                LinkedIn
                            </Button>
                        </div>

                        <div className="relative flex items-center gap-3 my-6">
                            <div className="flex-1 h-px bg-discord-border" />
                            <span className="text-[11px] text-discord-faint font-medium uppercase tracking-wider">already a member?</span>
                            <div className="flex-1 h-px bg-discord-border" />
                        </div>

                        <Button variant="secondary" fullWidth onClick={() => navigate('/login')}>Log In</Button>

                        <p className="mt-4 text-[11px] text-discord-faint text-center leading-relaxed">
                            This site is protected by reCAPTCHA and the Google
                            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="ml-1 text-blurple hover:underline">
                                Privacy Policy
                            </a>
                            and
                            <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="ml-1 text-blurple hover:underline">
                                Terms of Service
                            </a>
                            apply.
                        </p>
                    </div>

                    <div className={`text-center mt-6 transition-all duration-500 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-discord-muted hover:text-white transition-colors font-medium">
                            <ArrowLeft className="w-4 h-4" /> Back to home
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default SignupPage;
