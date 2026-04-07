import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Sparkles, KeyRound, Send } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import InputField from '../components/InputField';
import Button from '../components/Button';
import { useAuthStore } from '../stores/authStore';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaError, setCaptchaError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [mounted, setMounted] = useState(false);
    const recaptchaSiteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();

    const { forgotPassword, isLoading, error, message, clearError } = useAuthStore();

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => { clearError(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) { setEmailError('Email is required'); return; }
        if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Enter a valid email'); return; }
        if (recaptchaSiteKey && !captchaToken) { setCaptchaError('Please complete the reCAPTCHA check'); return; }
        setEmailError('');
        setCaptchaError('');
        try {
            await forgotPassword(email, captchaToken);
            setSubmitted(true);
        } catch { /* error set in store */ }
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
                <Link to="/login" className="text-sm font-medium text-discord-muted hover:text-white transition-colors">Log In</Link>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10">
                <div className={`mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-blurple shadow-lg shadow-blurple/30 flex items-center justify-center">
                            <KeyRound className="w-7 h-7 text-white" strokeWidth={2} />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-blurple/20 blur-xl -z-10 animate-pulse-glow" />
                    </div>
                </div>

                <div className={`text-center mb-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">Forgot Password?</h1>
                    <p className="text-sm sm:text-base text-discord-muted font-medium max-w-xs mx-auto">
                        No worries. Enter your email and we&rsquo;ll send you a reset link.
                    </p>
                </div>

                <section className={`w-full max-w-[420px] mx-auto transition-all duration-700 delay-300
                    ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="relative bg-discord-darker rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/20 border border-discord-border/50">
                        {submitted ? (
                            <div className="text-center py-4 animate-scale-in">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-discord-green/10 flex items-center justify-center">
                                    <Send className="w-7 h-7 text-discord-green" strokeWidth={2} />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
                                <p className="text-sm text-discord-muted mb-1">
                                    {message || 'If an account exists, a reset link has been sent.'}
                                </p>
                                <p className="text-xs text-discord-faint mt-3">
                                    Didn&rsquo;t receive it? Check your spam folder or
                                    <button onClick={() => { setSubmitted(false); clearError(); }}
                                        className="text-blurple font-semibold hover:underline ml-1 cursor-pointer">
                                        try again
                                    </button>
                                </p>
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <div className="mb-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium text-center animate-shake">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <InputField id="forgot-email" label="Email Address" type="email"
                                        placeholder="you@example.com" value={email}
                                        onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                                        error={emailError} icon={<Mail className="w-4 h-4" strokeWidth={2} />} />

                                    <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading}
                                        icon={!isLoading && <Send className="w-4 h-4" strokeWidth={2} />}>
                                        {isLoading ? 'Sending…' : 'Send Reset Link'}
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
                            </>
                        )}
                    </div>

                    <div className={`text-center mt-6 transition-all duration-500 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-discord-muted hover:text-white transition-colors font-medium">
                            <ArrowLeft className="w-4 h-4" /> Back to login
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default ForgotPasswordPage;
