import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, LogIn, Sparkles, ShieldCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { SiApple } from 'react-icons/si';
import { FaLinkedinIn } from 'react-icons/fa';
import InputField from '../components/InputField';
import Button from '../components/Button';
import CursorFollower from '../components/CursorFollower';
import { useAuthStore } from '../stores/authStore';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [mounted, setMounted] = useState(false);
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
    const [twoFactorToken, setTwoFactorToken] = useState('');
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [twoFactorError, setTwoFactorError] = useState('');
    const navigate = useNavigate();

    const { login, googleLogin, startAppleLogin, startLinkedInLogin, verifyTwoFactorLogin, isLoading, error, clearError } = useAuthStore();
    const [googleLoading, setGoogleLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => { clearError(); }, []);

    const validate = () => {
        const errs = {};
        if (!email.trim()) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
        if (!password) errs.password = 'Password is required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        try {
            const data = await login(email, password);
            if (data?.requiresTwoFactor) {
                setRequiresTwoFactor(true);
                setTwoFactorToken(data.twoFactorToken || '');
                setTwoFactorError('');
                return;
            }
            navigate('/feed');
        } catch { /* error is set in store */ }
    };

    const handleTwoFactorSubmit = async (e) => {
        e.preventDefault();
        setTwoFactorError('');
        if (!twoFactorCode.trim()) {
            setTwoFactorError('Enter the 6-digit code from your authenticator app');
            return;
        }

        try {
            await verifyTwoFactorLogin(twoFactorToken, twoFactorCode.trim());
            navigate('/feed');
        } catch (err) {
            setTwoFactorError(err.message || 'Invalid verification code');
        }
    };

    return (
        <div className="min-h-screen min-h-[100dvh] bg-discord-darkest relative overflow-hidden flex flex-col">
            <CursorFollower />
            {/* Ambient background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-28 -left-24 w-72 h-72 rounded-full bg-blurple/[0.08] blur-[100px]" />
                <div className="absolute bottom-[20%] -right-20 w-56 h-56 rounded-full bg-indigo-600/[0.05] blur-[80px]" />
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
                <Link to="/signup" className="text-sm font-medium text-discord-muted hover:text-white transition-colors">
                    Sign Up
                </Link>
            </header>

            {/* Main */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10">
                {/* Icon */}
                <div className={`mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-blurple shadow-lg shadow-blurple/30 flex items-center justify-center">
                            <LogIn className="w-7 h-7 text-white" strokeWidth={2} />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-blurple/20 blur-xl -z-10 animate-pulse-glow" />
                    </div>
                </div>

                {/* Heading */}
                <div className={`text-center mb-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">Welcome back</h1>
                    <p className="text-sm sm:text-base text-discord-muted font-medium">Log in to your CircleCore account.</p>
                </div>

                {/* Card */}
                <section className={`w-full max-w-[420px] mx-auto transition-all duration-700 delay-300
                    ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="relative bg-discord-darker rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/20 border border-discord-border/50">
                        {/* Server error */}
                        {error && (
                            <div className="mb-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium text-center animate-shake">
                                {error}
                            </div>
                        )}
                        {twoFactorError && (
                            <div className="mb-5 px-4 py-3 bg-discord-yellow/10 border border-discord-yellow/20 rounded-lg text-sm text-discord-yellow font-medium text-center">
                                {twoFactorError}
                            </div>
                        )}

                        {!requiresTwoFactor ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <InputField
                                id="login-email"
                                label="Email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                                error={errors.email}
                                icon={<Mail className="w-4 h-4" strokeWidth={2} />}
                            />

                            <InputField
                                id="login-password"
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                                error={errors.password}
                                icon={<Lock className="w-4 h-4" strokeWidth={2} />}
                            />

                            {/* Forgot password link */}
                            <div className="flex justify-end">
                                <Link to="/forgot-password"
                                    className="text-xs font-medium text-blurple hover:underline transition-colors">
                                    Forgot password?
                                </Link>
                            </div>

                            <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading}
                                icon={!isLoading && <LogIn className="w-4 h-4" strokeWidth={2} />}>
                                {isLoading ? 'Logging in…' : 'Log In'}
                            </Button>
                        </form>
                        ) : (
                        <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
                            <div className="rounded-xl border border-blurple/30 bg-blurple/10 px-4 py-3 text-sm text-discord-light flex items-start gap-3">
                                <ShieldCheck className="w-5 h-5 text-blurple shrink-0 mt-0.5" />
                                <p>Two-factor authentication is enabled on this account. Enter the 6-digit code from your authenticator app.</p>
                            </div>
                            <InputField
                                id="two-factor-code"
                                label="2FA Code"
                                type="text"
                                placeholder="123456"
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                icon={<ShieldCheck className="w-4 h-4" strokeWidth={2} />}
                                autoComplete="one-time-code"
                            />
                            <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading}
                                icon={!isLoading && <ShieldCheck className="w-4 h-4" strokeWidth={2} />}>
                                {isLoading ? 'Verifying…' : 'Verify & Continue'}
                            </Button>
                            <Button type="button" variant="secondary" fullWidth onClick={() => { setRequiresTwoFactor(false); setTwoFactorToken(''); setTwoFactorCode(''); setTwoFactorError(''); }}>
                                Back to Login
                            </Button>
                        </form>
                        )}

                        {/* Divider */}
                        <div className="relative flex items-center gap-3 my-5">
                            <div className="flex-1 h-px bg-discord-border" />
                            <span className="text-[11px] text-discord-faint font-medium uppercase tracking-wider">or</span>
                            <div className="flex-1 h-px bg-discord-border" />
                        </div>

                        {/* Google sign in */}
                        <div className="flex justify-center [&>div]:w-full">
                            <GoogleLogin
                                onSuccess={async (credentialResponse) => {
                                    setGoogleLoading(true);
                                    try {
                                        await googleLogin(credentialResponse.credential);
                                        navigate('/feed');
                                    } catch { /* error handled in store */ }
                                    setGoogleLoading(false);
                                }}
                                onError={() => {
                                    useAuthStore.getState().clearError();
                                }}
                                theme="filled_black"
                                size="large"
                                width="100%"
                                text="signin_with"
                                shape="rectangular"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <Button
                                type="button"
                                variant="secondary"
                                className="bg-[#1d1d1f] border-[#3a3a3c] text-white hover:bg-[#2a2a2d]"
                                onClick={() => startAppleLogin()}
                                icon={<SiApple className="w-4 h-4" />}
                                fullWidth
                            >
                                Apple
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="bg-[#0A66C2] border-[#0A66C2] text-white hover:bg-[#0959ac] hover:border-[#0959ac]"
                                onClick={() => startLinkedInLogin()}
                                icon={<FaLinkedinIn className="w-4 h-4" />}
                                fullWidth
                            >
                                LinkedIn
                            </Button>
                        </div>

                        {/* Divider */}
                        <div className="relative flex items-center gap-3 my-5">
                            <div className="flex-1 h-px bg-discord-border" />
                            <span className="text-[11px] text-discord-faint font-medium uppercase tracking-wider">new here?</span>
                            <div className="flex-1 h-px bg-discord-border" />
                        </div>

                        {/* Sign Up CTA */}
                        <Button variant="secondary" fullWidth onClick={() => navigate('/signup')}>
                            Create an account
                        </Button>
                    </div>

                    {/* Back link */}
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

export default LoginPage;
