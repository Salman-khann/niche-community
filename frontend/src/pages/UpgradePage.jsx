import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Crown, ArrowLeft, ArrowRight, Shield, Zap, Star, Lock, HeartHandshake } from 'lucide-react';
import { SiStripe } from 'react-icons/si';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Button from '../components/Button';
import { useProfileStore } from '../stores/profileStore';
import { useBillingStore } from '../stores/billingStore';

const UpgradePage = () => {
    const navigate = useNavigate();
    const rootRef = useRef(null);
    const [actionMessage, setActionMessage] = useState('');
    const { profile, fetchProfile } = useProfileStore();
    const {
        createCheckoutSession,
        fetchSubscriptionStatus,
        fetchInvoices,
        setAutoRenewal,
        createPortalSession,
        subscription,
        invoices,
        isLoading,
        error,
    } = useBillingStore();

    const isPremium = useMemo(
        () => ['premium', 'enterprise'].includes(profile?.tier || 'free'),
        [profile?.tier]
    );

    const handleSubscribe = async (plan = 'premium') => {
        try {
            const data = await createCheckoutSession(plan);
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch {
            // Store error is shown below.
        }
    };

    const handleOpenBillingPortal = async () => {
        setActionMessage('');
        try {
            const data = await createPortalSession();
            if (data?.url) window.location.href = data.url;
        } catch {
            // Store error is shown below.
        }
    };

    const handleAutoRenewToggle = async () => {
        setActionMessage('');
        try {
            const currentlyOn = !subscription?.cancelAtPeriodEnd;
            const data = await setAutoRenewal(!currentlyOn);
            setActionMessage(data?.message || 'Subscription updated');
            await fetchSubscriptionStatus();
            await fetchInvoices();
            if (profile?.userId?._id) await fetchProfile(profile.userId._id);
        } catch {
            // Store error is shown below.
        }
    };

    useEffect(() => {
        fetchSubscriptionStatus().catch(() => {});
        fetchInvoices().catch(() => {});
    }, [fetchSubscriptionStatus, fetchInvoices]);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;
        gsap.registerPlugin(ScrollTrigger);
        const ctx = gsap.context(() => {
            gsap.from('.hero-line', {
                y: 24,
                opacity: 0,
                duration: 0.9,
                ease: 'power3.out',
                stagger: 0.08,
            });

            gsap.utils.toArray('.reveal').forEach((el) => {
                gsap.from(el, {
                    opacity: 0,
                    y: 30,
                    duration: 0.9,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 82%',
                    },
                });
            });
        }, rootRef);

        return () => ctx.revert();
    }, []);

    const scrollToBenefits = () => {
        const section = document.getElementById('benefits');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const perks = [
        {
            title: 'Premium-only channels',
            description: 'Unlock exclusive spaces with curated, members-only discussions.',
            icon: Lock,
        },
        {
            title: 'Priority community perks',
            description: 'Get early access to new community experiments and beta drops.',
            icon: Zap,
        },
        {
            title: 'Premium badge',
            description: 'Stand out with a premium badge on your profile everywhere.',
            icon: Star,
        },
        {
            title: 'Safety-first moderation',
            description: 'Better tools for keeping the space respectful and focused.',
            icon: Shield,
        },
        {
            title: 'Trusted membership',
            description: 'Support the community and help fund better experiences.',
            icon: HeartHandshake,
        },
        {
            title: 'Stripe-secure checkout',
            description: 'Payments handled safely with Stripe’s trusted flow.',
            icon: SiStripe,
            isBrand: true,
        },
    ];

    const highlights = [
        { label: 'Premium-only channels', value: 'Access gated content' },
        { label: 'Priority perks', value: 'Early feature access' },
        { label: 'Verified status', value: 'Premium badge' },
        { label: 'Safe communities', value: 'Enhanced moderation' },
    ];

    const hasActiveSubscription = ['active', 'trialing', 'past_due'].includes(subscription?.subscriptionStatus || profile?.subscriptionStatus || 'inactive');
    const autoRenewEnabled = hasActiveSubscription && !subscription?.cancelAtPeriodEnd;
    const hasBillingCustomer = Boolean(subscription?.stripeCustomerId);
    const currentPeriodEndLabel = subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    return (
        <div ref={rootRef} className="min-h-screen min-h-[100dvh] bg-discord-darkest text-white relative overflow-x-hidden">
            {/* Ambient background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-28 -left-24 w-72 h-72 rounded-full bg-blurple/[0.1] blur-[100px]" />
                <div className="absolute top-[30%] -right-32 w-96 h-96 rounded-full bg-emerald-400/[0.08] blur-[120px]" />
                <div className="absolute bottom-[10%] left-[20%] w-80 h-80 rounded-full bg-indigo-500/[0.08] blur-[120px]" />
            </div>

            <div className="relative z-10">
                <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="hero-line flex items-center gap-1.5 text-sm font-semibold text-discord-muted hover:text-discord-light transition-colors cursor-pointer mb-8"
                    >
                        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                        Back
                    </button>

                    <div className="hero-line inline-flex items-center gap-2 px-3 py-1 rounded-full border border-discord-border/50 bg-discord-darkest/70 text-xs font-semibold tracking-[0.2em] uppercase text-discord-faint">
                        <Sparkles className="w-3.5 h-3.5" />
                        CircleCore Plus
                    </div>

                    <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 mt-6 items-center">
                        <div>
                            <h1 className="hero-line text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
                                Upgrade your community experience with CircleCore Plus.
                            </h1>
                            <p className="hero-line mt-4 text-base sm:text-lg text-discord-muted max-w-2xl">
                                Premium channels, priority perks, and a badge that shows you support the community. Everything you love — elevated.
                            </p>

                            <div className="hero-line mt-6 flex flex-col sm:flex-row gap-3">
                                <Button variant="primary" onClick={scrollToBenefits}>
                                    Explore benefits
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                                {isPremium ? (
                                    <Button variant="secondary" onClick={() => navigate('/feed')}>
                                        You are already Premium
                                    </Button>
                                ) : (
                                    <Button variant="secondary" onClick={() => handleSubscribe('premium')} loading={isLoading}>
                                        Subscribe now
                                    </Button>
                                )}
                            </div>

                            {error && (
                                <p className="hero-line mt-4 text-sm font-semibold text-discord-red">{error}</p>
                            )}
                        </div>

                        <div className="hero-line">
                            <div className="rounded-3xl border border-discord-border/60 bg-gradient-to-br from-[#2a2d3b] via-[#1e2434] to-[#2f2a44] p-6 shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Crown className="w-5 h-5 text-blurple" />
                                        <h2 className="text-xl font-black">CircleCore Plus</h2>
                                    </div>
                                    <span className="text-xs font-semibold text-discord-faint">Monthly</span>
                                </div>
                                <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/80 p-4 mb-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-discord-faint">Highlights</p>
                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                        {highlights.map((item) => (
                                            <div key={item.label} className="rounded-xl border border-discord-border/50 bg-discord-darkest/60 px-3 py-2">
                                                <p className="text-xs text-discord-faint">{item.label}</p>
                                                <p className="text-sm font-semibold text-white mt-1">{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-discord-light">
                                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-discord-green" />Premium-only channels</div>
                                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-discord-green" />Premium badge visibility</div>
                                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-discord-green" />Priority perks and support</div>
                                </div>

                                <div className="mt-6">
                                    {isPremium ? (
                                        <Button variant="secondary" fullWidth onClick={() => navigate('/feed')}>
                                            You Are Already Premium
                                        </Button>
                                    ) : (
                                        <Button variant="primary" fullWidth onClick={() => handleSubscribe('premium')} loading={isLoading}>
                                            Subscribe Now
                                        </Button>
                                    )}
                                </div>
                                {!isPremium && (
                                    <div className="mt-3">
                                        <Button variant="ghost" fullWidth onClick={() => handleSubscribe('enterprise')} loading={isLoading}>
                                            Start Enterprise Checkout
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <section id="benefits" className="reveal max-w-6xl mx-auto px-4 py-14">
                    <div className="flex items-center justify-between gap-6 flex-wrap">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-discord-faint">Benefits</p>
                            <h2 className="text-2xl sm:text-3xl font-black mt-2">Everything you need to go premium.</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-discord-faint">
                            <SiStripe className="w-4 h-4" />
                            Secured by Stripe
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                        {perks.map((perk) => {
                            const Icon = perk.icon;
                            return (
                                <div key={perk.title} className="rounded-2xl border border-discord-border/60 bg-discord-darker/80 p-5 shadow-lg">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                        perk.isBrand ? 'bg-[#635bff]/20 text-[#a5b4fc]' : 'bg-discord-darkest text-blurple'
                                    }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-semibold mt-4">{perk.title}</h3>
                                    <p className="text-sm text-discord-muted mt-2">{perk.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="reveal max-w-6xl mx-auto px-4 py-14">
                    <div className="rounded-3xl border border-discord-border/60 bg-[#1f2431]/85 p-8 sm:p-10">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-discord-faint">Billing Management</p>
                                <h2 className="text-2xl sm:text-3xl font-black mt-2">Manage membership, renewals, and invoices.</h2>
                                <p className="text-sm text-discord-muted mt-2">
                                    Subscription: <span className="text-discord-light font-semibold">{subscription?.plan || (profile?.tier || 'free')}</span>
                                    {' '}• Status: <span className="text-discord-light font-semibold">{subscription?.subscriptionStatus || profile?.subscriptionStatus || 'inactive'}</span>
                                    {currentPeriodEndLabel ? ` • Current period ends ${currentPeriodEndLabel}` : ''}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" onClick={handleOpenBillingPortal} loading={isLoading} disabled={!hasBillingCustomer}>
                                    Open Stripe Billing Portal
                                </Button>
                                {hasActiveSubscription && (
                                    <Button variant="ghost" onClick={handleAutoRenewToggle} loading={isLoading}>
                                        {autoRenewEnabled ? 'Turn Off Auto-Renew' : 'Turn On Auto-Renew'}
                                    </Button>
                                )}
                            </div>
                        </div>
                        {actionMessage && (
                            <p className="mt-3 text-sm text-discord-light">{actionMessage}</p>
                        )}
                        {error && (
                            <p className="mt-2 text-sm font-semibold text-discord-red">{error}</p>
                        )}

                        <div className="mt-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-discord-faint">Recent Invoices</p>
                            {invoices.length === 0 ? (
                                <p className="mt-2 text-sm text-discord-muted">No invoices yet.</p>
                            ) : (
                                <div className="mt-3 grid gap-2">
                                    {invoices.slice(0, 8).map((invoice) => (
                                        <div key={invoice.id} className="rounded-xl border border-discord-border/60 bg-discord-darkest/60 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-discord-light">{invoice.number}</p>
                                                <p className="text-xs text-discord-faint">
                                                    {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : 'Unknown date'}
                                                    {' '}• Tax: {((invoice.tax || 0) / 100).toFixed(2)} {(invoice.currency || 'usd').toUpperCase()}
                                                    {' '}• Total: {((invoice.total || 0) / 100).toFixed(2)} {(invoice.currency || 'usd').toUpperCase()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {invoice.hostedInvoiceUrl && (
                                                    <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blurple hover:text-blurple-hover">
                                                        View
                                                    </a>
                                                )}
                                                {invoice.invoicePdf && (
                                                    <a href={invoice.invoicePdf} target="_blank" rel="noreferrer" className="text-xs font-semibold text-discord-light hover:text-white">
                                                        PDF
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="reveal max-w-6xl mx-auto px-4 py-14">
                    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
                        <div className="space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-discord-faint">Why Plus</p>
                            <h2 className="text-2xl sm:text-3xl font-black">Built for people who care about quality communities.</h2>
                            <p className="text-sm text-discord-muted">
                                CircleCore Plus powers better moderation, higher signal-to-noise, and a richer experience for members who want more.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <span className="px-3 py-1.5 rounded-full bg-discord-darkest border border-discord-border/60 text-xs text-discord-light">Invite-only communities</span>
                                <span className="px-3 py-1.5 rounded-full bg-discord-darkest border border-discord-border/60 text-xs text-discord-light">Premium gating</span>
                                <span className="px-3 py-1.5 rounded-full bg-discord-darkest border border-discord-border/60 text-xs text-discord-light">Live events</span>
                                <span className="px-3 py-1.5 rounded-full bg-discord-darkest border border-discord-border/60 text-xs text-discord-light">Safety tooling</span>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-discord-border/60 bg-gradient-to-br from-[#1f2537] via-[#1f2b33] to-[#1d2638] p-6">
                            <div className="grid sm:grid-cols-2 gap-4">
                                {[
                                    { title: 'Focus mode', value: 'Noise-free channels' },
                                    { title: 'Member trust', value: 'Verified badges' },
                                    { title: 'Premium gating', value: 'Exclusive access' },
                                    { title: 'Event perks', value: 'Priority invites' },
                                ].map((item) => (
                                    <div key={item.title} className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.2em] text-discord-faint">{item.title}</p>
                                        <p className="text-lg font-semibold mt-2">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="reveal max-w-6xl mx-auto px-4 py-14">
                    <div className="rounded-3xl border border-discord-border/60 bg-discord-darker/80 p-8 sm:p-10">
                        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-discord-faint">Membership</p>
                                <h2 className="text-2xl sm:text-3xl font-black mt-2">Choose the experience that fits your vibe.</h2>
                                <p className="text-sm text-discord-muted mt-3">
                                    Free is great for getting started. Plus is for members who want deeper access and to support the community.
                                </p>
                            </div>
                            <div className="space-y-3 text-sm text-discord-light">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-discord-faint" />
                                    </div>
                                    Free includes community access and core features.
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center">
                                        <Crown className="w-4 h-4 text-blurple" />
                                    </div>
                                    Plus unlocks exclusive channels, perks, and badges.
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center">
                                        <SiStripe className="w-4 h-4 text-[#a5b4fc]" />
                                    </div>
                                    Secure monthly billing handled by Stripe.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="reveal max-w-6xl mx-auto px-4 pb-16">
                    <div className="rounded-3xl border border-discord-border/60 bg-gradient-to-r from-blurple/20 via-indigo-500/10 to-emerald-400/10 p-8 sm:p-10">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-discord-faint">Ready?</p>
                                <h2 className="text-2xl sm:text-3xl font-black mt-2">Go Plus and unlock premium channels today.</h2>
                                <p className="text-sm text-discord-muted mt-3 max-w-2xl">
                                    Your membership powers better moderation, safer spaces, and exclusive content for everyone.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button variant="secondary" onClick={() => navigate('/feed')}>
                                    Keep browsing
                                </Button>
                                {isPremium ? (
                                    <Button variant="primary" onClick={() => navigate('/feed')}>
                                        You Are Already Premium
                                    </Button>
                                ) : (
                                    <Button variant="primary" onClick={() => handleSubscribe('premium')} loading={isLoading}>
                                        Subscribe with Stripe
                                    </Button>
                                )}
                            </div>
                        </div>
                        {error && (
                            <p className="mt-4 text-sm font-semibold text-discord-red">{error}</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default UpgradePage;
