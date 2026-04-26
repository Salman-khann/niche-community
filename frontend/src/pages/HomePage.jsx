import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../config/urls';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    Sparkles,
    Lock,
    ArrowRight,
    Users,
    Globe,
    Zap,
    Ticket,
    ShieldCheck,
    MessageSquare,
    Rocket,
    LifeBuoy,
    Briefcase,
    Building2,
    Hash,
    Star,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Play,
    Shield,
    Calendar,
    Award,
    Heart,
    Github,
    Twitter,
} from 'lucide-react';
import Button from '../components/Button';
import CursorFollower from '../components/CursorFollower';
import InputField from '../components/InputField';

gsap.registerPlugin(ScrollTrigger);

/* ── FAQ Accordion Item ─────────────────────────────────────────────────── */
const FaqItem = ({ question, answer, isOpen, onToggle }) => (
    <div className="border-b border-discord-border last:border-0">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between py-4 px-1 text-left cursor-pointer group"
        >
            <span className="text-sm sm:text-base font-semibold text-discord-white group-hover:text-blurple transition-colors">
                {question}
            </span>
            <ChevronDown
                className={`w-4 h-4 text-discord-muted transition-transform duration-300 shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
            />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-4' : 'max-h-0'}`}>
            <p className="text-sm text-discord-muted leading-relaxed px-1">{answer}</p>
        </div>
    </div>
);

/* ── Animated Counter ───────────────────────────────────────────────────── */
const AnimatedCounter = ({ value, suffix = '' }) => {
    const ref = useRef(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (!ref.current || hasAnimated.current) return;
        const numericPart = parseFloat(value.replace(/[^0-9.]/g, ''));
        const prefix = value.match(/^[^0-9]*/)?.[0] || '';
        const valueSuffix = value.match(/[^0-9.]*$/)?.[0] || '';
        if (isNaN(numericPart)) { ref.current.textContent = value; return; }

        const obj = { val: 0 };
        ScrollTrigger.create({
            trigger: ref.current,
            start: 'top 85%',
            once: true,
            onEnter: () => {
                hasAnimated.current = true;
                gsap.to(obj, {
                    val: numericPart,
                    duration: 1.8,
                    ease: 'power2.out',
                    onUpdate: () => {
                        if (!ref.current) return;
                        const display = numericPart % 1 !== 0
                            ? obj.val.toFixed(1)
                            : Math.round(obj.val).toLocaleString();
                        ref.current.textContent = prefix + display + valueSuffix;
                    },
                });
            },
        });
    }, [value]);

    return <span ref={ref}>0</span>;
};

/* ── Main HomePage Component ────────────────────────────────────────────── */
const HomePage = () => {
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openFaq, setOpenFaq] = useState(null);
    const navigate = useNavigate();

    // Refs for GSAP
    const heroRef = useRef(null);
    const navRef = useRef(null);
    const statsRef = useRef(null);
    const featuresRef = useRef(null);
    const noAdsRef = useRef(null);
    const aboutRef = useRef(null);
    const testimonialsRef = useRef(null);
    const ctaRef = useRef(null);
    const faqRef = useRef(null);
    const contactRef = useRef(null);
    const footerRef = useRef(null);
    const ambientRef = useRef(null);
    const marqueeRef = useRef(null);
    const ctxRef = useRef(null);

    /* ── GSAP scroll-reveal helper ─────────────────────────────────────── */
    const scrollReveal = useCallback((targets, triggerEl, fromVars, extra = {}) => {
        if (!targets || !triggerEl) return;
        const nodes = targets instanceof NodeList || Array.isArray(targets) ? targets : [targets];
        if (nodes.length === 0) return;

        gsap.fromTo(nodes, {
            opacity: 0,
            ...fromVars,
        }, {
            opacity: 1,
            x: 0, y: 0, scale: 1, rotateX: 0,
            ...extra,
            scrollTrigger: {
                trigger: triggerEl,
                start: extra.start || 'top 88%',
                toggleActions: 'play none none none',
            },
        });
    }, []);

    /* ── GSAP Master Animations ──────────────────────────────────────────── */
    useEffect(() => {
        // Small delay to ensure React has finished painting
        const raf = requestAnimationFrame(() => {
            const ctx = gsap.context(() => {
                // ── Ambient floating blobs ──
                if (ambientRef.current) {
                    const blobs = ambientRef.current.querySelectorAll('.ambient-blob');
                    blobs.forEach((blob, i) => {
                        gsap.to(blob, {
                            y: gsap.utils.random(-30, 30),
                            x: gsap.utils.random(-20, 20),
                            scale: gsap.utils.random(0.9, 1.1),
                            duration: gsap.utils.random(4, 7),
                            ease: 'sine.inOut',
                            repeat: -1,
                            yoyo: true,
                            delay: i * 0.5,
                        });
                    });
                }

                // ── Nav entrance (no scroll trigger — plays immediately) ──
                if (navRef.current) {
                    gsap.fromTo(navRef.current,
                        { y: -40, opacity: 0 },
                        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 }
                    );
                }

                // ── Hero section staggered reveal (plays on load, no scroll trigger) ──
                if (heroRef.current) {
                    const heroEls = heroRef.current.querySelectorAll('.hero-badge, .hero-headline, .hero-subtitle, .hero-cta, .hero-invite-card');
                    gsap.fromTo(heroEls,
                        { y: 50, opacity: 0, scale: 0.95 },
                        {
                            y: 0, opacity: 1, scale: 1,
                            duration: 0.7,
                            ease: 'power3.out',
                            stagger: 0.12,
                            delay: 0.3,
                        }
                    );
                }

                // ── Stats counter section ──
                if (statsRef.current) {
                    scrollReveal(
                        statsRef.current.querySelectorAll('.stat-item'),
                        statsRef.current,
                        { y: 40, scale: 0.9 },
                        { stagger: 0.12, duration: 0.7, ease: 'power3.out' }
                    );
                }

                // ── Features section ──
                if (featuresRef.current) {
                    scrollReveal(
                        featuresRef.current.querySelectorAll('.feature-header'),
                        featuresRef.current,
                        { y: 50 },
                        { duration: 0.8, ease: 'power3.out' }
                    );

                    const featureGrid = featuresRef.current.querySelector('.feature-grid');
                    if (featureGrid) {
                        scrollReveal(
                            featuresRef.current.querySelectorAll('.feature-card'),
                            featureGrid,
                            { y: 60, scale: 0.92 },
                            { stagger: 0.1, duration: 0.7, ease: 'power3.out' }
                        );
                    }
                }

                // ── About section split reveal ──
                if (aboutRef.current) {
                    const aboutText = aboutRef.current.querySelector('.about-text');
                    if (aboutText) {
                        scrollReveal(aboutText, aboutRef.current, { x: -80 }, { duration: 0.9, ease: 'power3.out' });
                    }

                    const aboutValues = aboutRef.current.querySelector('.about-values');
                    if (aboutValues) {
                        scrollReveal(
                            aboutRef.current.querySelectorAll('.about-value-card'),
                            aboutValues,
                            { x: 60, scale: 0.9 },
                            { stagger: 0.1, duration: 0.7, ease: 'power3.out' }
                        );
                    }
                }

                // ── No Ads Section ──
                if (noAdsRef.current) {
                    scrollReveal(
                        noAdsRef.current.querySelectorAll('.noads-item'),
                        noAdsRef.current,
                        { y: 50, opacity: 0 },
                        { stagger: 0.12, duration: 0.8, ease: 'power3.out' }
                    );
                }

                // ── Testimonials ──
                if (testimonialsRef.current) {
                    scrollReveal(
                        testimonialsRef.current.querySelector('.testimonials-header'),
                        testimonialsRef.current,
                        { y: 40 },
                        { duration: 0.7, ease: 'power3.out' }
                    );

                    const tGrid = testimonialsRef.current.querySelector('.testimonials-grid');
                    if (tGrid) {
                        scrollReveal(
                            testimonialsRef.current.querySelectorAll('.testimonial-card'),
                            tGrid,
                            { y: 50, rotateX: 15 },
                            { stagger: 0.15, duration: 0.8, ease: 'power3.out' }
                        );
                    }
                }

                // ── CTA Banner ──
                if (ctaRef.current) {
                    scrollReveal(
                        ctaRef.current.querySelector('.cta-banner'),
                        ctaRef.current,
                        { y: 60, scale: 0.92 },
                        { duration: 0.9, ease: 'power3.out' }
                    );
                }

                // ── FAQ Section ──
                if (faqRef.current) {
                    scrollReveal(
                        faqRef.current.querySelector('.faq-header'),
                        faqRef.current,
                        { y: 40 },
                        { duration: 0.7, ease: 'power3.out' }
                    );

                    const faqCard = faqRef.current.querySelector('.faq-card');
                    if (faqCard) {
                        scrollReveal(faqCard, faqCard, { y: 40 }, { duration: 0.7, ease: 'power3.out' });
                    }
                }

                // ── Contact Section ──
                if (contactRef.current) {
                    scrollReveal(
                        contactRef.current.querySelector('.contact-header'),
                        contactRef.current,
                        { y: 40 },
                        { duration: 0.7, ease: 'power3.out' }
                    );

                    const cGrid = contactRef.current.querySelector('.contact-grid');
                    if (cGrid) {
                        scrollReveal(
                            contactRef.current.querySelectorAll('.contact-item'),
                            cGrid,
                            { y: 50, scale: 0.9 },
                            { stagger: 0.12, duration: 0.7, ease: 'back.out(1.4)' }
                        );
                    }
                }

                // ── Horizontal marquee (scroll-scrub) ──
                if (marqueeRef.current) {
                    const row1 = marqueeRef.current.querySelector('.marquee-row-1');
                    const row2 = marqueeRef.current.querySelector('.marquee-row-2');

                    if (row1) {
                        gsap.fromTo(row1, { x: '0%' }, {
                            x: '-25%',
                            ease: 'none',
                            scrollTrigger: {
                                trigger: marqueeRef.current,
                                start: 'top bottom',
                                end: 'bottom top',
                                scrub: 0.5,
                            },
                        });
                    }
                    if (row2) {
                        gsap.fromTo(row2, { x: '-25%' }, {
                            x: '0%',
                            ease: 'none',
                            scrollTrigger: {
                                trigger: marqueeRef.current,
                                start: 'top bottom',
                                end: 'bottom top',
                                scrub: 0.5,
                            },
                        });
                    }
                }

                // ── Footer ──
                if (footerRef.current) {
                    scrollReveal(footerRef.current, footerRef.current, { y: 30 }, { duration: 0.8, ease: 'power3.out', start: 'top 95%' });
                }

                // Ensure ScrollTrigger recalculates positions after everything is set up
                ScrollTrigger.refresh();
            });

            // Store context for cleanup
            ctxRef.current = ctx;
        });

        return () => {
            cancelAnimationFrame(raf);
            ctxRef.current?.revert();
        };
    }, [scrollReveal]);

    /* ── Validate invite code via API ── */
    const handleSignUp = async () => {
        const code = inviteCode.trim();
        if (!code) { setError('Please enter an invite code'); return; }
        setError('');
        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/invites/validate'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                sessionStorage.setItem('circlecore_invite_code', code);
                navigate('/signup');
            } else {
                setError(data?.message || 'Invalid or expired invite code');
            }
        } catch {
            setError('Could not connect to server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSignUp(); };

    /* ── Data ── */
    const stats = [
        { value: '12K+', label: 'Members', icon: Users },
        { value: '500+', label: 'Communities', icon: Globe },
        { value: '1M+', label: 'Messages', icon: MessageSquare },
        { value: '99.9%', label: 'Uptime', icon: Zap },
    ];

    const featureHero = {
        title: 'Make your community feel alive',
        desc: 'Invite‑only access, real‑time updates, events, and moderation — all in one clean, powerful space built for focused communities.',
        panelFrom: '#5b6af5',
        panelTo: '#8b3df7',
        mediaFrom: '#5c1a4a',
        mediaTo: '#ea4bc1',
    };

    const testimonials = [
        {
            name: 'Sarah Chen',
            role: 'Community Lead, TechStartup',
            text: 'CircleCore transformed how we manage our beta community. The moderation tools alone saved us hundreds of hours.',
            avatar: '🧑‍💻',
        },
        {
            name: 'Marcus Webb',
            role: 'Creator, DesignCircle',
            text: 'Finally, a platform that puts quality over quantity. Our invite-only model helped us build an incredible community.',
            avatar: '🎨',
        },
        {
            name: 'Priya Patel',
            role: 'Engineering Manager',
            text: 'We moved our entire internal team to CircleCore. The channel organization and real-time features are exactly what we needed.',
            avatar: '⚡',
        },
    ];

    const faqs = [
        { q: 'What is CircleCore?', a: 'CircleCore is a modern community platform for invite-only groups. Think of it as a premium space where quality conversations happen without the noise.' },
        { q: 'How do I get an invite code?', a: 'Request one from an existing member or community admin. Each community manages their own invite codes to ensure quality membership.' },
        { q: 'Is CircleCore free?', a: 'CircleCore offers a free tier with all essential features. Premium tiers unlock advanced moderation, analytics, and unlimited channels.' },
        { q: 'Can I create my own community?', a: 'Absolutely! After signing up, you can create your own workspace and start inviting members immediately.' },
        { q: 'How is CircleCore different from Discord?', a: 'CircleCore is built for curated, invite-only communities. We focus on trust, reputation, and meaningful engagement rather than mass scale.' },
        { q: 'How do I configure my microphone and camera?', a: 'CircleCore allows you to seamlessly select your preferred microphone, speaker, and camera within your User Profile, including live testing tools to verify your AV inputs.' },
        { q: 'Does CircleCore support Push-to-Talk?', a: 'Yes, you can toggle between Voice Activity and Push-to-Talk input modes, complete with custom keyboard or mouse button keybinds for seamless audio control.' },
        { q: 'Can I review moderation actions taken in my community?', a: 'Absolutely. Community admins have access to a robust Audit Log where you can instantly track critical moderation events such as member kicks and role adjustments.' },
        { q: 'How do custom roles and permissions work?', a: 'You can intuitively create custom roles with tailored permissions—such as the ability to manage messages or configure server settings—and assign them directly via the Roster.' },
        { q: 'Is there support for Two-Factor Authentication (2FA)?', a: 'Yes, to add an extra layer of security, you can enable 2FA directly within your Account Security settings by scanning the generated QR code via any authenticator app.' },
        { q: 'How can I personalize my app\'s theme?', a: 'Under your Appearance settings, you can toggle between "Dark", "Darker", and "Aurora" gradient themes, while actively previewing the global color token shifts.' },
        { q: 'Can I disable animations if I find them distracting?', a: 'Yes, the accessibility suite features a "Reduce Motion" component that minimizes animated transitions across the application interface for a more comfortable experience.' },
        { q: 'How do I invite members directly to my community?', a: 'Server administrators can generate one-time invite codes or directly send server invites to existing platform users through the dedicated Community Invite interface.' },
        { q: 'Can I customize how often I receive email notifications?', a: 'Yes, your Profile Settings allow you to securely dictate your email digest frequency—choosing between daily digests, weekly summaries, or turning them off entirely.' },
        { q: 'Who has the power to delete messages?', a: 'Message deletion is strictly governed by custom Server Roles. Only members assigned a role with the exact "Manage Messages" permission enabled are granted chat moderation abilities.' },
    ];

    const footerColumns = [
        {
            heading: 'Product',
            links: [
                { label: 'Features', href: '#features' },
                { label: 'Community Feed', onClick: () => navigate('/feed') },
                { label: 'Pricing', onClick: () => navigate('/upgrade') },
            ],
        },
        {
            heading: 'Company',
            links: [
                { label: 'About', href: '#about' },
                { label: 'Careers', icon: Briefcase },
                { label: 'Contact', href: '#contact' },
                { label: 'Partners', icon: Users },
            ],
        },
    ];

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-discord-darkest text-discord-white overflow-hidden">
            <CursorFollower />

            {/* ═══════════  AMBIENT BACKGROUND  ═══════════ */}
            <div ref={ambientRef} className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="ambient-blob absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-blurple/[0.07] blur-[120px]" />
                <div className="ambient-blob absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/[0.05] blur-[100px]" />
                <div className="ambient-blob absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full bg-purple-600/[0.04] blur-[80px]" />
            </div>

            {/* ═══════════  NAVIGATION  ═══════════ */}
            <nav ref={navRef} className="sticky top-0 z-50 bg-discord-darkest/80 backdrop-blur-xl border-b border-white/[0.06]">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 py-3.5">
                    <div className="flex items-center gap-8">
                        {/* Logo */}
                        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center shadow-lg shadow-blurple/25">
                                <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
                            </div>
                            <span className="text-base font-bold tracking-tight text-white">CircleCore</span>
                        </div>

                        {/* Nav links */}
                        <div className="hidden md:flex items-center gap-6">
                            {[
                                { label: 'Features', id: 'features' },
                                { label: 'About', id: 'about' },
                                { label: 'FAQ', id: 'faq' },
                                { label: 'Contact', id: 'contact' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => scrollTo(item.id)}
                                    className="text-sm font-medium text-discord-muted hover:text-white transition-colors cursor-pointer"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Auth buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm font-medium text-discord-light hover:text-white transition-colors cursor-pointer"
                        >
                            Log In
                        </button>
                        <Button variant="primary" size="sm" onClick={() => navigate('/signup')}>
                            Sign Up
                        </Button>
                    </div>
                </div>
            </nav>

            {/* ═══════════  HERO SECTION  ═══════════ */}
            <section ref={heroRef} className="relative pt-16 sm:pt-24 pb-16 sm:pb-24">
                <div className="max-w-5xl mx-auto px-5 sm:px-8 text-center">
                    {/* Badge */}
                    <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 bg-blurple/10 border border-blurple/20 rounded-full mb-8">
                        <Sparkles className="w-3.5 h-3.5 text-blurple" strokeWidth={2.5} />
                        <span className="text-xs font-semibold text-blurple tracking-wide uppercase">Invite-Only Communities</span>
                    </div>

                    {/* Headline */}
                    <h1 className="hero-headline text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                        Your circle,{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blurple via-indigo-400 to-purple-400">
                            your&nbsp;rules.
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="hero-subtitle text-base sm:text-lg md:text-xl text-discord-muted font-medium max-w-2xl mx-auto leading-relaxed mb-10">
                        The platform where curated communities thrive. Built for trust, quality conversations,
                        and the people who value real connections over endless noise.
                    </p>

                    {/* CTA Buttons */}
                    <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                        <Button variant="primary" size="lg" onClick={() => navigate('/signup')}
                            icon={<ArrowRight className="w-4 h-4" strokeWidth={2} />}>
                            Get Started Free
                        </Button>
                        <Button variant="secondary" size="lg" onClick={() => scrollTo('features')}
                            icon={<Play className="w-4 h-4" strokeWidth={2} />}>
                            See How It Works
                        </Button>
                    </div>

                    {/* ── Invite Code Card ── */}
                    <div className="hero-invite-card max-w-md mx-auto">
                        <div className="relative bg-discord-darker rounded-xl p-5 border border-discord-border shadow-2xl shadow-black/20">
                            <div className="flex items-center gap-2 mb-3">
                                <Lock className="w-3.5 h-3.5 text-blurple" strokeWidth={2.5} />
                                <span className="text-xs font-bold text-discord-muted uppercase tracking-wider">Have an invite code?</span>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <input
                                        placeholder="Enter invite code"
                                        value={inviteCode}
                                        onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setError(''); }}
                                        onKeyDown={handleKeyDown}
                                        className="w-full rounded-lg bg-discord-darkest text-discord-white text-sm font-medium
                                            placeholder:text-discord-faint/50 outline-none border border-discord-darkest
                                            focus:border-blurple focus:ring-2 focus:ring-blurple/30 px-3.5 py-2.5 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleSignUp}
                                    disabled={!inviteCode.trim() || loading}
                                    className="px-5 py-2.5 bg-blurple hover:bg-blurple-hover text-white text-sm font-semibold rounded-lg
                                        transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                                        shadow-md hover:shadow-lg hover:shadow-blurple/25"
                                >
                                    {loading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                                    )}
                                </button>
                            </div>
                            {error && (
                                <p className="mt-2 text-xs font-medium text-discord-red">{error}</p>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════  STATS BAR  ═══════════ */}
            <section ref={statsRef} className="relative py-8 border-y border-white/[0.06] bg-discord-darker/50">
                <div className="max-w-5xl mx-auto px-5 sm:px-8">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                        {stats.map((stat, i) => (
                            <div key={i} className="stat-item flex flex-col items-center gap-1.5 py-2">
                                <stat.icon className="w-5 h-5 text-blurple mb-1" strokeWidth={2} />
                                <p className="text-2xl sm:text-3xl font-black text-white">
                                    <AnimatedCounter value={stat.value} />
                                </p>
                                <p className="text-xs font-medium text-discord-muted uppercase tracking-wider">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════  HORIZONTAL SCROLL MARQUEE  ═══════════ */}
            <section ref={marqueeRef} className="relative py-12 sm:py-16 overflow-hidden select-none">
                <div className="space-y-4">
                    {/* Row 1 — scrolls left on scroll */}
                    <div className="marquee-row-1 flex gap-4 whitespace-nowrap will-change-transform" style={{ width: 'max-content' }}>
                        {[...Array(2)].map((_, copy) => (
                            <div key={copy} className="flex gap-4">
                                {[
                                    { text: 'Invite-Only Access', icon: Lock },
                                    { text: 'Organized Channels', icon: Hash },
                                    { text: 'Real-Time Feed', icon: Zap },
                                    { text: 'Built on Trust', icon: Shield },
                                    { text: 'Community Events', icon: Calendar },
                                    { text: 'Powerful Moderation', icon: ShieldCheck },
                                    { text: 'Roles & Reputation', icon: Award },
                                    { text: 'Premium Tiers', icon: Star },
                                ].map((item) => (
                                    <div
                                        key={item.text + copy}
                                        className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-discord-darker/60 border border-discord-border/30"
                                    >
                                        <item.icon className="w-4 h-4 text-blurple shrink-0" strokeWidth={2} />
                                        <span className="text-sm font-bold text-discord-light tracking-wide">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Row 2 — scrolls right on scroll (opposite) */}
                    <div className="marquee-row-2 flex gap-4 whitespace-nowrap will-change-transform" style={{ width: 'max-content' }}>
                        {[...Array(2)].map((_, copy) => (
                            <div key={copy} className="flex gap-4">
                                {[
                                    { text: 'Quality Conversations', icon: MessageSquare },
                                    { text: 'Workspace Switcher', icon: Building2 },
                                    { text: 'Community Feed', icon: Globe },
                                    { text: 'Team Collaboration', icon: Users },
                                    { text: 'Open Source', icon: Heart },
                                    { text: 'Scale Ready', icon: Rocket },
                                    { text: 'Smart Notifications', icon: Sparkles },
                                    { text: 'Premium Support', icon: LifeBuoy },
                                ].map((item) => (
                                    <div
                                        key={item.text + copy}
                                        className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-blurple/[0.06] border border-blurple/15"
                                    >
                                        <item.icon className="w-4 h-4 text-indigo-400 shrink-0" strokeWidth={2} />
                                        <span className="text-sm font-bold text-discord-muted tracking-wide">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════  FEATURES  ═══════════ */}
            <section ref={featuresRef} id="features" className="relative py-20 sm:py-28">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    {/* Section header */}
                    <div className="feature-header text-center mb-14">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blurple mb-3">Features</p>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
                            Everything&nbsp;you need to run a{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blurple to-purple-400">
                                thriving community
                            </span>
                        </h2>
                        <p className="text-base text-discord-muted max-w-xl mx-auto">
                            Powerful tools that make managing your community feel effortless.
                        </p>
                    </div>

                    {/* Feature cards */}
                    <div className="feature-grid">
                        <div
                            className="feature-panel feature-card"
                            style={{
                                '--panel-from': featureHero.panelFrom,
                                '--panel-to': featureHero.panelTo,
                                '--media-from': featureHero.mediaFrom,
                                '--media-to': featureHero.mediaTo,
                            }}
                        >
                            <div className="feature-panel__inner">
                                <div className="feature-panel__media">
                                    <div className="feature-panel__window">
                                        <div className="feature-panel__bar" />
                                        <div className="feature-panel__line" />
                                        <div className="feature-panel__line short" />
                                        <div className="feature-panel__line tiny" />
                                    </div>
                                    <div className="feature-panel__pill">Invite Only</div>
                                </div>
                                <div className="feature-panel__copy">
                                    <p className="feature-panel__kicker">CircleCore Features</p>
                                    <h3 className="feature-panel__title">{featureHero.title}</h3>
                                    <p className="feature-panel__desc">{featureHero.desc}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════  NO ADS SECTION  ═══════════ */}
            <section ref={noAdsRef} className="relative py-20 sm:py-28">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <div className="grid md:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
                        <div className="noads-item">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blurple mb-3">Privacy First</p>
                            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4">
                                No ads. No trackers. No kidding.
                            </h2>
                            <p className="text-base text-discord-muted leading-relaxed max-w-xl">
                                There are no ads, no affiliate marketers, and no creepy tracking in CircleCore.
                                Focus on real conversations with the people who matter to you.
                            </p>
                        </div>

                        <div className="relative noads-item">
                            <div className="rounded-3xl overflow-hidden border border-white/10 shadow-[0_18px_50px_rgba(8,8,12,0.35)] bg-[#8D64F6]">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" className="w-full h-full" style={{ backgroundColor: '#8D64F6' }}>
                                    <defs>
                                        <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                                            <circle cx="2" cy="2" r="1.5" fill="#181818" />
                                        </pattern>
                                    </defs>
                                    <rect x="320" y="120" width="120" height="80" fill="url(#dots)" />
                                    <rect x="590" y="310" width="60" height="130" fill="url(#dots)" />
                                    <rect x="200" y="450" width="170" height="70" fill="url(#dots)" />
                                    <g transform="translate(130, 110)">
                                        <rect width="190" height="210" fill="#EBEBEB" stroke="#181818" strokeWidth="4" />
                                        <line x1="20" y1="50" x2="110" y2="50" stroke="#181818" strokeWidth="14" />
                                        <rect x="20" y="150" width="100" height="30" fill="#2B64F5" />
                                    </g>
                                    <g transform="translate(470, 125)">
                                        <rect width="180" height="170" fill="#EBEBEB" stroke="#181818" strokeWidth="4" />
                                        <line x1="60" y1="40" x2="150" y2="40" stroke="#181818" strokeWidth="4" />
                                        <line x1="60" y1="60" x2="130" y2="60" stroke="#181818" strokeWidth="4" />
                                    </g>
                                    <rect x="410" y="150" width="125" height="45" fill="#2B64F5" stroke="#181818" strokeWidth="4" />
                                    <g transform="translate(430, 360)">
                                        <rect width="160" height="100" fill="#EBEBEB" stroke="#181818" strokeWidth="4" />
                                        <circle cx="30" cy="35" r="9" fill="#181818" />
                                        <line x1="50" y1="35" x2="110" y2="35" stroke="#181818" strokeWidth="4" />
                                    </g>
                                    <g transform="translate(170, 350)">
                                        <rect width="240" height="110" fill="#EBEBEB" stroke="#181818" strokeWidth="4" />
                                        <line x1="20" y1="35" x2="160" y2="35" stroke="#181818" strokeWidth="5" />
                                        <line x1="20" y1="55" x2="100" y2="55" stroke="#181818" strokeWidth="5" />
                                        <rect x="0" y="75" width="240" height="35" fill="#2B64F5" stroke="#181818" strokeWidth="4" />
                                    </g>
                                    <g transform="translate(230, 195)">
                                        <rect width="330" height="210" fill="#EBEBEB" stroke="#181818" strokeWidth="4" />
                                        <line x1="65" y1="60" x2="265" y2="60" stroke="#181818" strokeWidth="5" />
                                        <line x1="90" y1="85" x2="240" y2="85" stroke="#181818" strokeWidth="5" />
                                        <rect x="90" y="125" width="150" height="35" fill="#2B64F5" />
                                    </g>
                                    <g stroke="#181818" strokeWidth="14" fill="none" strokeLinecap="butt">
                                        <circle cx="400" cy="300" r="225" />
                                        <line x1="559" y1="141" x2="241" y2="459" />
                                    </g>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════  ABOUT SECTION  ═══════════ */}
            <section ref={aboutRef} id="about" className="relative py-20 sm:py-28 bg-discord-darker/40">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left side — text */}
                        <div className="about-text">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blurple mb-3">About CircleCore</p>
                            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-6 leading-tight">
                                Built for communities that{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blurple to-indigo-400">
                                    value quality
                                </span>
                            </h2>
                            <p className="text-base text-discord-muted leading-relaxed mb-6">
                                We believe the best communities are intentional. CircleCore was built from the ground up
                                for groups that care about who's in the room — where every member adds value and every
                                conversation matters.
                            </p>
                            <p className="text-base text-discord-muted leading-relaxed mb-8">
                                Whether you're building a startup community, managing an internal team, or running a
                                creator network, CircleCore gives you the tools to create a space that feels like home.
                            </p>
                            <Button variant="primary" onClick={() => navigate('/signup')}
                                icon={<ArrowRight className="w-4 h-4" strokeWidth={2} />}>
                                Start Building Your Community
                            </Button>
                        </div>

                        {/* Right side — values grid */}
                        <div className="about-values grid grid-cols-2 gap-3">
                            {[
                                { icon: Shield, title: 'Trust First', desc: 'Invite-only access ensures quality', color: 'text-emerald-400' },
                                { icon: Users, title: 'People-Centric', desc: 'Built around real relationships', color: 'text-blue-400' },
                                { icon: Rocket, title: 'Scale Ready', desc: 'Grows with your community', color: 'text-amber-400' },
                                { icon: Heart, title: 'Open Source', desc: 'Transparent and community-driven', color: 'text-rose-400' },
                            ].map((val) => (
                                <div key={val.title}
                                    className="about-value-card bg-discord-darkest/60 border border-discord-border/40 rounded-xl p-4 hover:border-discord-border transition-colors">
                                    <val.icon className={`w-5 h-5 ${val.color} mb-3`} strokeWidth={2} />
                                    <h4 className="text-sm font-bold text-white mb-1">{val.title}</h4>
                                    <p className="text-xs text-discord-muted">{val.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════  TESTIMONIALS  ═══════════ */}
            <section ref={testimonialsRef} className="relative py-20 sm:py-28" style={{ perspective: '1000px' }}>
                <div className="max-w-5xl mx-auto px-5 sm:px-8">
                    <div className="testimonials-header text-center mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blurple mb-3">Testimonials</p>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                            Loved by community builders
                        </h2>
                    </div>

                    <div className="testimonials-grid grid sm:grid-cols-3 gap-4">
                        {testimonials.map((t, i) => (
                            <div key={i}
                                className="testimonial-card bg-discord-darker/80 border border-discord-border/50 rounded-xl p-6 hover:border-discord-border transition-all duration-300">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-discord-darkest flex items-center justify-center text-lg">
                                        {t.avatar}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{t.name}</p>
                                        <p className="text-xs text-discord-faint">{t.role}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-discord-muted leading-relaxed italic">"{t.text}"</p>
                                <div className="flex gap-0.5 mt-4">
                                    {[...Array(5)].map((_, j) => (
                                        <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" strokeWidth={0} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════  CTA BANNER  ═══════════ */}
            <section ref={ctaRef} className="relative py-20 sm:py-24">
                <div className="max-w-4xl mx-auto px-5 sm:px-8">
                    <div className="cta-banner relative bg-gradient-to-r from-blurple via-indigo-500 to-purple-600 rounded-2xl p-8 sm:p-14 text-center overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/[0.06] -translate-y-1/2 translate-x-1/4 blur-2xl" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/[0.04] translate-y-1/2 -translate-x-1/4 blur-xl" />
                        </div>

                        <div className="relative z-10">
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                                Ready to start your community?
                            </h2>
                            <p className="text-base sm:text-lg text-white/70 mb-8 max-w-lg mx-auto">
                                Join thousands of builders creating meaningful connections on CircleCore.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="px-8 py-3.5 bg-white text-blurple font-bold text-sm rounded-lg hover:bg-white/90
                                        transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl active:scale-[0.98]"
                                >
                                    Sign Up — It's Free
                                </button>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="px-8 py-3.5 bg-white/10 text-white font-semibold text-sm rounded-lg
                                        border border-white/20 hover:bg-white/20 transition-all duration-200 cursor-pointer"
                                >
                                    Already have an account?
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════  FAQ SECTION  ═══════════ */}
            <section ref={faqRef} id="faq" className="relative py-20 sm:py-28 bg-discord-darker/40">
                <div className="max-w-2xl mx-auto px-5 sm:px-8">
                    <div className="faq-header text-center mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blurple mb-3">FAQ</p>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                            Frequently asked questions
                        </h2>
                    </div>

                    <div className="faq-card bg-discord-darker/80 border border-discord-border/50 rounded-xl p-5 sm:p-6">
                        {faqs.map((faq, i) => (
                            <FaqItem
                                key={i}
                                question={faq.q}
                                answer={faq.a}
                                isOpen={openFaq === i}
                                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════  CONTACT SECTION  ═══════════ */}
            <section ref={contactRef} id="contact" className="relative py-20 sm:py-28 overflow-hidden" style={{ backgroundColor: '#7B6CF6' }}>
                <div className="contact-ambience" aria-hidden="true">
                    <div className="contact-orb contact-orb--one" />
                    <div className="contact-orb contact-orb--two" />
                    <div className="contact-orb contact-orb--three" />
                    <div className="contact-spark contact-spark--one" />
                    <div className="contact-spark contact-spark--two" />
                </div>
                <div className="max-w-5xl mx-auto px-5 sm:px-8">
                    <div className="contact-header text-center mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80 mb-3">Contact</p>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4">
                            Get in touch
                        </h2>
                        <p className="text-base text-white/85 max-w-md mx-auto leading-relaxed">
                            <span className="block">Have questions or need help?</span>
                            <span className="block">We’d love to hear from you.</span>
                        </p>
                    </div>

                    <div className="contact-grid grid md:grid-cols-[1fr_1fr] gap-8 items-center">
                        <div className="contact-item space-y-6">
                            <div className="rounded-2xl border border-white/15 bg-[#1f2026]/90 px-6 py-6 min-h-[140px] flex flex-col justify-center">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70 mb-1">Community</p>
                                <p className="text-base font-semibold text-white">Join our public forum</p>
                                <p className="text-xs text-white/60 mt-1 leading-relaxed">Announcements • Roadmap • Feedback</p>
                            </div>
                        </div>
                        <div className="contact-item">
                            <div className="contact-illustration rounded-3xl overflow-hidden border border-white/15 shadow-[0_18px_50px_rgba(8,8,12,0.35)] bg-[#5C6AF7]">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" className="w-full h-full" style={{ backgroundColor: '#5C6AF7' }}>
                                    <defs>
                                        <pattern id="dots-contact" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                                            <circle cx="2" cy="2" r="1.3" fill="#1B1E25" />
                                        </pattern>
                                        <clipPath id="globe-clip">
                                            <circle cx="400" cy="320" r="195" />
                                        </clipPath>
                                    </defs>
                                    <circle cx="410" cy="330" r="195" fill="url(#dots-contact)" />
                                    <circle cx="400" cy="320" r="195" fill="#96B6F5" />
                                    <g clipPath="url(#globe-clip)">
                                        <path d="M180 200 L 210 180 L 240 190 L 260 170 L 280 175 L 290 150 L 320 160 L 340 145 L 360 165 L 380 180 L 370 200 L 390 220 L 380 240 L 350 245 L 340 270 L 320 280 L 300 290 L 280 285 L 260 250 L 230 230 Z" fill="#2D5DF6"/>
                                        <path d="M260 140 L 280 120 L 310 130 L 320 150 L 290 155 Z" fill="#2D5DF6"/>
                                        <path d="M350 110 L 380 100 L 410 130 L 420 160 L 390 175 L 360 140 Z" fill="#2D5DF6"/>
                                        <path d="M290 300 L 320 295 L 340 310 L 380 320 L 400 340 L 420 370 L 400 420 L 380 470 L 360 500 L 340 460 L 330 420 L 310 360 L 295 330 Z" fill="#2D5DF6"/>
                                        <path d="M430 170 L 450 150 L 480 145 L 520 150 L 560 165 L 580 190 L 590 220 L 580 250 L 550 260 L 510 240 L 480 220 L 450 210 Z" fill="#2D5DF6"/>
                                        <path d="M440 240 L 470 230 L 500 240 L 530 260 L 550 300 L 540 350 L 500 410 L 470 370 L 460 330 L 430 280 Z" fill="#2D5DF6"/>
                                        <path d="M 230 500 Q 400 460 570 500 L 500 550 L 300 550 Z" fill="#2D5DF6" />
                                        <circle cx="230" cy="300" r="4" fill="#2D5DF6" />
                                        <circle cx="245" cy="320" r="3" fill="#2D5DF6" />
                                        <circle cx="220" cy="340" r="5" fill="#2D5DF6" />
                                        <circle cx="420" cy="220" r="4" fill="#2D5DF6" />
                                        <circle cx="435" cy="240" r="6" fill="#2D5DF6" />
                                    </g>
                                    <circle cx="400" cy="320" r="195" fill="url(#dots-contact)" />
                                    <circle cx="400" cy="320" r="195" fill="none" stroke="#1B1E25" strokeWidth="5" />
                                    <g fill="#E6E1DF" stroke="#1B1E25" strokeWidth="4" strokeLinejoin="round">
                                        <path d="M 210 70 h 140 a 25 25 0 0 1 25 25 v 0 a 25 25 0 0 1 -25 25 h -100 q -5 60 -10 90 q -10 -60 -15 -90 h -15 a 25 25 0 0 1 -25 -25 v 0 a 25 25 0 0 1 25 -25 Z" />
                                        <path d="M 305 230 h 150 a 25 25 0 0 1 25 25 v 0 a 25 25 0 0 1 -25 25 h -110 q -5 60 10 120 q -20 -80 -25 -120 h -25 a 25 25 0 0 1 -25 -25 v 0 a 25 25 0 0 1 25 -25 Z" />
                                        <path d="M 445 140 h 130 a 25 25 0 0 1 25 25 v 0 a 25 25 0 0 1 -25 25 h -15 q -5 40 -20 80 q 5 -40 5 -80 h -100 a 25 25 0 0 1 -25 -25 v 0 a 25 25 0 0 1 25 -25 Z" />
                                    </g>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════  FOOTER  ═══════════ */}
            <footer ref={footerRef} className="relative bg-discord-darkest border-t border-white/[0.06] pt-12 pb-6">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 mb-10">
                        {/* Brand Column */}
                        <div className="col-span-1">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
                                </div>
                                <span className="text-sm font-bold text-white">CircleCore</span>
                            </div>
                            <p className="text-xs text-discord-faint leading-relaxed max-w-[200px]">
                                Invite-only communities for serious builders and creators.
                            </p>
                        </div>

                        {/* Link Columns */}
                        {footerColumns.map((col) => (
                            <div key={col.heading}>
                                <h5 className="text-[11px] font-bold uppercase tracking-[0.15em] text-discord-muted mb-3">
                                    {col.heading}
                                </h5>
                                <div className="space-y-2">
                                    {col.links.map((link) => (
                                        <button
                                            key={link.label}
                                            onClick={link.onClick || (link.href ? () => scrollTo(link.href.replace('#', '')) : undefined)}
                                            className="w-full text-left text-sm text-discord-faint hover:text-discord-light transition-colors cursor-pointer flex items-center gap-1.5"
                                        >
                                            {link.icon && <link.icon className="w-3.5 h-3.5 text-discord-faint" strokeWidth={2} />}
                                            {link.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom bar */}
                    <div className="border-t border-white/[0.06] pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-discord-faint">© {new Date().getFullYear()} CircleCore. All rights reserved.</p>
                        <p className="text-xs text-discord-faint">Invite-only communities for serious builders.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;
