import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Pencil, X, LogOut, Camera, ShieldCheck, ShieldAlert, QrCode } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useFeedStore } from '../stores/feedStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useDropzone } from 'react-dropzone';

const BANNER_COLORS = [
    '#334155',
    '#f472b6',
    '#f97316',
    '#f59e0b',
    '#facc15',
    '#8b5cf6',
    '#38bdf8',
    '#22d3ee',
    '#22c55e',
    '#111827',
];

const USER_SETTINGS_SECTIONS = [
    { label: 'My Account', key: 'account' },
    { label: 'Security', key: 'security' },
    { label: 'Notifications', key: 'notifications' },
];

const APP_SETTINGS_SECTIONS = [
    { label: 'Voice & Video', key: 'voiceVideo' },
    { label: 'Appearance', key: 'appearance' },
    { label: 'Accessibility', key: 'accessibility' },
];

const BILLING_SECTIONS = [
    { id: 'circlecore-plus', label: 'CircleCore Plus', badge: 'Premium' },
];

const ProfileSettingsModal = ({ isOpen, onClose, profile, user, onSave }) => {
    const navigate = useNavigate();
    const { logout, getTwoFactorSetup, enableTwoFactor, disableTwoFactor } = useAuthStore();
    const { prefs: notificationPrefs, fetchPrefs: fetchNotificationPrefs, updatePrefs: updateNotificationPrefs } = useNotificationStore();
    const initial = useMemo(() => ({
        displayName: profile?.displayName || user?.name || '',
        pronouns: profile?.pronouns || '',
        bannerColor: profile?.bannerColor || '#3f4f4f',
        bio: profile?.bio || '',
        avatar: profile?.avatar || '',
    }), [profile, user]);

    const [activeTab, setActiveTab] = useState('main');
    const [activeSection, setActiveSection] = useState('account');
    const [displayName, setDisplayName] = useState(initial.displayName);
    const [pronouns, setPronouns] = useState(initial.pronouns);
    const [bannerColor, setBannerColor] = useState(initial.bannerColor);
    const [bio, setBio] = useState(initial.bio);
    const [avatar, setAvatar] = useState(initial.avatar);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [twoFactorSetup, setTwoFactorSetup] = useState(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [twoFactorError, setTwoFactorError] = useState('');
    const [twoFactorMessage, setTwoFactorMessage] = useState('');
    const [twoFactorBusy, setTwoFactorBusy] = useState(false);
    const [notificationBusy, setNotificationBusy] = useState(false);
    const [notificationError, setNotificationError] = useState('');
    const [notificationMessage, setNotificationMessage] = useState('');
    const [voiceMode, setVoiceMode] = useState('voice');
    const [appearanceTheme, setAppearanceTheme] = useState('dark');
    const [reduceMotion, setReduceMotion] = useState(false);
    const { uploadFile } = useFeedStore();
    const [privacy, setPrivacy] = useState({
        improveData: profile?.dataPrivacy?.improveData ?? true,
        personalizeActivity: profile?.dataPrivacy?.personalizeActivity ?? true,
        thirdPartyPersonalization: profile?.dataPrivacy?.thirdPartyPersonalization ?? true,
        personalizeExperience: profile?.dataPrivacy?.personalizeExperience ?? true,
        voiceClips: profile?.dataPrivacy?.voiceClips ?? true,
    });

    useEffect(() => {
        if (!isOpen) return;
        setDisplayName(initial.displayName);
        setPronouns(initial.pronouns);
        setBannerColor(initial.bannerColor);
        setBio(initial.bio);
        setAvatar(initial.avatar);
        setAvatarError('');
        setPrivacy({
            improveData: profile?.dataPrivacy?.improveData ?? true,
            personalizeActivity: profile?.dataPrivacy?.personalizeActivity ?? true,
            thirdPartyPersonalization: profile?.dataPrivacy?.thirdPartyPersonalization ?? true,
            personalizeExperience: profile?.dataPrivacy?.personalizeExperience ?? true,
            voiceClips: profile?.dataPrivacy?.voiceClips ?? true,
        });
        setTwoFactorSetup(null);
        setTwoFactorCode('');
        setTwoFactorError('');
        setTwoFactorMessage('');
        setNotificationError('');
        setNotificationMessage('');
        fetchNotificationPrefs().catch(() => { });
    }, [isOpen, initial]);

    const onAvatarDrop = useCallback(async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        setAvatarUploading(true);
        setAvatarError('');
        try {
            const url = await uploadFile(acceptedFiles[0]);
            setAvatar(url);
        } catch {
            setAvatarError('Upload failed. Try again.');
        } finally {
            setAvatarUploading(false);
        }
    }, [uploadFile]);

    const { getRootProps: getAvatarRootProps, getInputProps: getAvatarInputProps, isDragActive: isAvatarDragActive } = useDropzone({
        onDrop: onAvatarDrop,
        accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
        maxSize: 10 * 1024 * 1024,
        maxFiles: 1,
        multiple: false,
    });

    if (!isOpen) return null;

    const notificationsState = {
        emailDigestEnabled: notificationPrefs?.emailDigestEnabled ?? false,
        digestFrequency: notificationPrefs?.digestFrequency ?? 'daily',
        pushEnabled: notificationPrefs?.pushEnabled ?? false,
    };

    const canSave = displayName.trim().length > 0;
    const handleSave = async () => {
        if (!canSave || isSaving) return;
        setIsSaving(true);
        try {
            await onSave?.({
                displayName: displayName.trim(),
                pronouns: pronouns.trim(),
                bannerColor,
                bio,
                avatar,
                dataPrivacy: privacy,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await logout();
            onClose?.();
        } catch { }
    };

    const handleBillingClick = (sectionId) => {
        if (sectionId !== 'circlecore-plus') return;
        onClose?.();
        navigate('/upgrade');
    };

    const handleTwoFactorSetup = async () => {
        setTwoFactorBusy(true);
        setTwoFactorError('');
        setTwoFactorMessage('');
        try {
            const data = await getTwoFactorSetup();
            setTwoFactorSetup(data);
        } catch (error) {
            setTwoFactorError(error.message || 'Unable to start 2FA setup');
        } finally {
            setTwoFactorBusy(false);
        }
    };

    const handleTwoFactorEnable = async () => {
        if (!twoFactorSetup?.secret) {
            setTwoFactorError('Start 2FA setup first');
            return;
        }
        setTwoFactorBusy(true);
        setTwoFactorError('');
        setTwoFactorMessage('');
        try {
            await enableTwoFactor(twoFactorSetup.secret, twoFactorCode);
            setTwoFactorMessage('Two-factor authentication is now enabled.');
            setTwoFactorSetup(null);
            setTwoFactorCode('');
        } catch (error) {
            setTwoFactorError(error.message || 'Unable to enable 2FA');
        } finally {
            setTwoFactorBusy(false);
        }
    };

    const handleTwoFactorDisable = async () => {
        setTwoFactorBusy(true);
        setTwoFactorError('');
        setTwoFactorMessage('');
        try {
            await disableTwoFactor(twoFactorCode);
            setTwoFactorMessage('Two-factor authentication is now disabled.');
            setTwoFactorCode('');
            setTwoFactorSetup(null);
        } catch (error) {
            setTwoFactorError(error.message || 'Unable to disable 2FA');
        } finally {
            setTwoFactorBusy(false);
        }
    };

    const handleNotificationToggle = async (key, value) => {
        setNotificationBusy(true);
        setNotificationError('');
        setNotificationMessage('');
        try {
            await updateNotificationPrefs({ [key]: value });
            setNotificationMessage('Notification settings updated.');
        } catch (error) {
            setNotificationError(error.message || 'Unable to update notifications');
        } finally {
            setNotificationBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="absolute inset-0 md:inset-[5vh] rounded-none md:rounded-2xl bg-discord-dark shadow-2xl border border-discord-border/60 overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-full w-full grid grid-cols-1 md:grid-cols-[280px_1fr]">
                    <aside className="hidden md:flex h-full bg-[#2b2d31] border-r border-discord-border/50 px-4 py-5 flex-col gap-5 overflow-y-auto">
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-discord-darkest/70 px-3 py-2">
                            <div>
                                <p className="text-sm font-semibold text-white">{profile?.displayName || user?.name || 'User'}</p>
                                <p className="text-xs text-discord-faint">Edit Profiles</p>
                            </div>
                            <Pencil className="w-4 h-4 text-discord-faint" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-discord-faint mb-2">User Settings</p>
                            <div className="space-y-1">
                                {USER_SETTINGS_SECTIONS.map((section) => (
                                    <button
                                        key={section.label}
                                        onClick={() => setActiveSection(section.key)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                                            activeSection === section.key
                                                ? 'bg-discord-darkest text-white'
                                                : 'text-discord-faint hover:bg-discord-darkest/60'
                                        }`}
                                    >
                                        {section.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-discord-faint mb-2">App Settings</p>
                            <div className="space-y-1">
                                {APP_SETTINGS_SECTIONS.map((section) => (
                                    <button
                                        key={section.label}
                                        onClick={() => setActiveSection(section.key)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                                            activeSection === section.key
                                                ? 'bg-discord-darkest text-white'
                                                : 'text-discord-faint hover:bg-discord-darkest/60'
                                        }`}
                                    >
                                        {section.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-discord-faint mb-2">Billing Settings</p>
                            <div className="space-y-1">
                                {BILLING_SECTIONS.map((section) => (
                                    <button
                                        key={section.id || section.label}
                                        onClick={() => handleBillingClick(section.id)}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-discord-faint hover:bg-discord-darkest/60 flex items-center justify-between"
                                    >
                                        <span>{section.label}</span>
                                        {section.badge && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-discord-border/50 text-discord-light">
                                                {section.badge}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="mt-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-discord-red hover:bg-discord-darkest/60"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </aside>

                    <main className="h-full overflow-y-auto">
                        <div className="sticky top-0 z-10 bg-discord-dark/90 backdrop-blur border-b border-discord-border/60 px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
                            <div>
                                <p className="text-lg font-semibold text-white">
                                    {activeSection === 'account'
                                        ? 'My Account'
                                        : activeSection === 'security'
                                            ? 'Security'
                                            : activeSection === 'notifications'
                                                ? 'Notifications'
                                                : activeSection === 'voiceVideo'
                                                    ? 'Voice & Video'
                                                    : activeSection === 'appearance'
                                                        ? 'Appearance'
                                                        : activeSection === 'accessibility'
                                                            ? 'Accessibility'
                                                            : 'My Account'}
                                </p>
                                {activeSection === 'account' && (
                                    <div className="flex flex-wrap items-center gap-4 mt-2">
                                        <button
                                            onClick={() => setActiveTab('main')}
                                            className={`text-sm font-semibold pb-2 border-b-2 ${
                                                activeTab === 'main'
                                                    ? 'text-white border-blurple'
                                                    : 'text-discord-faint border-transparent hover:text-discord-light'
                                            }`}
                                        >
                                            Main Profile
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('server')}
                                            className={`text-sm font-semibold pb-2 border-b-2 ${
                                                activeTab === 'server'
                                                    ? 'text-white border-blurple'
                                                    : 'text-discord-faint border-transparent hover:text-discord-light'
                                            }`}
                                        >
                                            Per-server Profiles
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={!canSave || isSaving}
                                    className="px-3 sm:px-4 py-2 rounded-lg bg-blurple text-white text-sm font-semibold hover:bg-blurple/90 disabled:opacity-60"
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-9 h-9 rounded-full bg-discord-darkest/60 border border-discord-border/60 text-discord-faint hover:text-white"
                                >
                                    <X className="w-4 h-4 mx-auto" />
                                </button>
                            </div>
                        </div>

                        <div className="md:hidden border-b border-discord-border/60 px-5 py-3 space-y-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-discord-faint mb-2">User Settings</div>
                                <div className="flex flex-wrap gap-2">
                                    {USER_SETTINGS_SECTIONS.map((section) => (
                                        <button
                                            key={section.label}
                                            onClick={() => setActiveSection(section.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                                                activeSection === section.key
                                                    ? 'bg-discord-border-light/30 text-white'
                                                    : 'text-discord-faint hover:bg-discord-darkest/60'
                                            }`}
                                        >
                                            {section.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-discord-faint mb-2">App Settings</div>
                                <div className="flex flex-wrap gap-2">
                                    {APP_SETTINGS_SECTIONS.map((section) => (
                                        <button
                                            key={section.label}
                                            onClick={() => setActiveSection(section.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                                                activeSection === section.key
                                                    ? 'bg-discord-border-light/30 text-white'
                                                    : 'text-discord-faint hover:bg-discord-darkest/60'
                                            }`}
                                        >
                                            {section.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-discord-faint mb-2">Billing Settings</div>
                                <div className="flex flex-wrap gap-2">
                                    {BILLING_SECTIONS.map((section) => (
                                        <button
                                            key={section.id || section.label}
                                            onClick={() => handleBillingClick(section.id)}
                                            className="px-3 py-1.5 rounded-full text-xs font-semibold text-discord-faint hover:bg-discord-darkest/60 flex items-center gap-2"
                                        >
                                            <span>{section.label}</span>
                                            {section.badge && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-discord-border/50 text-discord-light">
                                                    {section.badge}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {activeSection === 'account' && activeTab === 'main' && (
                            <div className="px-5 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
                                <div className="space-y-6">
                                    <div className="rounded-xl bg-gradient-to-r from-[#2c2f36] via-[#254136] to-[#2d6b4f] p-4">
                                        <div className="text-discord-light text-sm">
                                            Give your profile a fresh look
                                            <p className="text-[11px] text-discord-faint mt-1">
                                                Customize your name, pronouns, and bio.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-discord-light">Profile Photo</label>
                                        <div
                                            {...getAvatarRootProps()}
                                            className={`mt-3 rounded-xl border border-dashed px-4 py-3 transition ${
                                                isAvatarDragActive ? 'border-blurple bg-blurple/10' : 'border-discord-border/60 bg-discord-darkest/60'
                                            }`}
                                        >
                                            <input {...getAvatarInputProps()} />
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-full bg-discord-darkest border border-discord-border/60 overflow-hidden flex items-center justify-center text-sm font-semibold text-discord-light">
                                                    {avatarUploading ? (
                                                        <div className="w-5 h-5 rounded-full border-2 border-blurple border-t-transparent animate-spin" />
                                                    ) : avatar ? (
                                                        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        (displayName || 'U').charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-discord-light font-semibold">
                                                        {avatarUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                                                    </p>
                                                    <p className="text-[11px] text-discord-faint">
                                                        JPG, PNG, GIF, or WEBP (max 10MB)
                                                    </p>
                                                </div>
                                                <div className="w-9 h-9 rounded-lg bg-discord-darkest flex items-center justify-center text-discord-faint">
                                                    <Camera className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                        {avatarError && (
                                            <p className="mt-2 text-xs text-discord-red">{avatarError}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-discord-light">Display Name</label>
                                        <input
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            className="mt-2 w-full rounded-lg bg-discord-darkest border border-discord-border/60 text-discord-white px-3 py-2 focus:outline-none focus:border-blurple"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-discord-light">Pronouns</label>
                                        <input
                                            value={pronouns}
                                            onChange={(e) => setPronouns(e.target.value)}
                                            placeholder="Add your pronouns"
                                            className="mt-2 w-full rounded-lg bg-discord-darkest border border-discord-border/60 text-discord-white px-3 py-2 placeholder:text-discord-faint/60 focus:outline-none focus:border-blurple"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-discord-light">Banner Color</label>
                                        <div className="mt-3 flex flex-wrap gap-3">
                                            {BANNER_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => setBannerColor(color)}
                                                    className={`w-14 h-12 rounded-xl border-2 ${
                                                        bannerColor === color ? 'border-blurple' : 'border-transparent'
                                                    }`}
                                                    style={{ backgroundColor: color }}
                                                >
                                                    {bannerColor === color && (
                                                        <Palette className="w-4 h-4 text-white mx-auto" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-discord-light">Bio</label>
                                        <p className="text-xs text-discord-faint mt-1">
                                            You can use markdown and links if you&apos;d like.
                                        </p>
                                        <div className="relative mt-3">
                                            <textarea
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                rows={4}
                                                maxLength={200}
                                                className="w-full rounded-lg bg-discord-darkest border border-discord-border/60 text-discord-white px-3 py-3 focus:outline-none focus:border-blurple resize-none"
                                            />
                                            <span className="absolute bottom-2 right-3 text-xs text-discord-faint">
                                                {200 - bio.length}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-sm font-semibold text-discord-light">Preview</p>
                                    <div className="rounded-2xl border border-discord-border/60 bg-discord-darker overflow-hidden">
                                        <div className="h-28" style={{ backgroundColor: bannerColor }} />
                                        <div className="px-5 pb-5 -mt-9">
                                            <div className="w-16 h-16 rounded-full bg-discord-darkest border-4 border-discord-darker overflow-hidden flex items-center justify-center">
                                                {avatar ? (
                                                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-lg font-bold text-discord-light">
                                                        {(displayName || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <button className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-discord-darkest text-xs text-discord-light">
                                                <span className="w-2 h-2 rounded-full bg-discord-green" />
                                                Add Status
                                            </button>
                                            <p className="mt-4 text-lg font-semibold text-white">{displayName || 'User'}</p>
                                            <p className="text-sm text-discord-faint">{user?._id || user?.username || 'user'}</p>
                                            <div className="mt-4">
                                                <button className="w-full py-2 rounded-lg bg-blurple text-white text-sm font-semibold">
                                                    Example Button
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'account' && activeTab === 'server' && (
                            <div className="px-5 sm:px-8 py-10 text-discord-faint text-sm">
                                Per-server profiles are coming soon.
                            </div>
                        )}

                        {activeSection === 'notifications' && (
                            <div className="px-5 sm:px-8 py-8">
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="rounded-3xl border border-discord-border/60 bg-discord-darkest/80 p-6 md:p-8">
                                        <p className="text-[11px] uppercase tracking-[0.3em] text-blurple/80 font-semibold">User Settings</p>
                                        <h2 className="text-2xl font-semibold text-white mt-2">Notifications</h2>
                                        <p className="text-sm text-discord-faint mt-2 max-w-2xl">
                                            Control digest and push preferences for your account.
                                        </p>

                                        {notificationError && (
                                            <div className="mt-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium">
                                                {notificationError}
                                            </div>
                                        )}
                                        {notificationMessage && (
                                            <div className="mt-5 px-4 py-3 bg-discord-green/10 border border-discord-green/20 rounded-lg text-sm text-discord-green font-medium">
                                                {notificationMessage}
                                            </div>
                                        )}

                                        <div className="mt-6 space-y-4">
                                            <div className="flex items-center justify-between gap-4 rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">Email digest</p>
                                                    <p className="text-xs text-discord-faint mt-1">Receive a summary of unread updates by email.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={notificationBusy}
                                                    onClick={() => handleNotificationToggle('emailDigestEnabled', !notificationsState.emailDigestEnabled)}
                                                    className={`relative w-12 h-6 rounded-full transition-colors ${notificationsState.emailDigestEnabled ? 'bg-blurple' : 'bg-discord-darkest'}`}
                                                >
                                                    <span className={`absolute top-0.5 ${notificationsState.emailDigestEnabled ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all`} />
                                                </button>
                                            </div>

                                            <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">Digest frequency</p>
                                                        <p className="text-xs text-discord-faint mt-1">Choose how often you want digest emails.</p>
                                                    </div>
                                                    <select
                                                        value={notificationsState.digestFrequency}
                                                        onChange={(e) => handleNotificationToggle('digestFrequency', e.target.value)}
                                                        disabled={notificationBusy}
                                                        className="rounded-lg border border-discord-border/60 bg-[#1e1f22] px-3 py-2 text-sm text-discord-light outline-none"
                                                    >
                                                        <option value="daily">Daily</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="off">Off</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-4 rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">Push notifications</p>
                                                    <p className="text-xs text-discord-faint mt-1">Allow browser and mobile push alerts.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={notificationBusy}
                                                    onClick={() => handleNotificationToggle('pushEnabled', !notificationsState.pushEnabled)}
                                                    className={`relative w-12 h-6 rounded-full transition-colors ${notificationsState.pushEnabled ? 'bg-blurple' : 'bg-discord-darkest'}`}
                                                >
                                                    <span className={`absolute top-0.5 ${notificationsState.pushEnabled ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'voiceVideo' && (
                            <div className="px-5 sm:px-8 py-8">
                                <div className="max-w-3xl mx-auto rounded-3xl border border-discord-border/60 bg-discord-darkest/80 p-6 md:p-8 space-y-6">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-[0.3em] text-blurple/80 font-semibold">App Settings</p>
                                        <h2 className="text-2xl font-semibold text-white mt-2">Voice & Video</h2>
                                        <p className="text-sm text-discord-faint mt-2">Basic voice and video preferences for the app.</p>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Input mode</p>
                                                <p className="text-xs text-discord-faint mt-1">Switch between voice activity and push to talk.</p>
                                            </div>
                                            <select value={voiceMode} onChange={(e) => setVoiceMode(e.target.value)} className="rounded-lg border border-discord-border/60 bg-[#1e1f22] px-3 py-2 text-sm text-discord-light outline-none">
                                                <option value="voice">Voice Activity</option>
                                                <option value="ptt">Push to Talk</option>
                                            </select>
                                        </div>
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Noise suppression</p>
                                                <p className="text-xs text-discord-faint mt-1">Reduce background noise in calls.</p>
                                            </div>
                                            <div className="text-xs text-discord-faint">Enabled</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'appearance' && (
                            <div className="px-5 sm:px-8 py-8">
                                <div className="max-w-3xl mx-auto rounded-3xl border border-discord-border/60 bg-discord-darkest/80 p-6 md:p-8 space-y-6">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-[0.3em] text-blurple/80 font-semibold">App Settings</p>
                                        <h2 className="text-2xl font-semibold text-white mt-2">Appearance</h2>
                                        <p className="text-sm text-discord-faint mt-2">Choose how the app looks and feels.</p>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Theme</p>
                                                <p className="text-xs text-discord-faint mt-1">The current UI is locked to the dark Discord palette.</p>
                                            </div>
                                            <select value={appearanceTheme} onChange={(e) => setAppearanceTheme(e.target.value)} className="rounded-lg border border-discord-border/60 bg-[#1e1f22] px-3 py-2 text-sm text-discord-light outline-none">
                                                <option value="dark">Dark</option>
                                                <option value="darker">Darker</option>
                                            </select>
                                        </div>
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Reduce motion</p>
                                                <p className="text-xs text-discord-faint mt-1">Minimize animated transitions across the app.</p>
                                            </div>
                                            <button type="button" onClick={() => setReduceMotion((value) => !value)} className={`relative w-12 h-6 rounded-full transition-colors ${reduceMotion ? 'bg-blurple' : 'bg-discord-darkest'}`}>
                                                <span className={`absolute top-0.5 ${reduceMotion ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'accessibility' && (
                            <div className="px-5 sm:px-8 py-8">
                                <div className="max-w-3xl mx-auto rounded-3xl border border-discord-border/60 bg-discord-darkest/80 p-6 md:p-8 space-y-6">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-[0.3em] text-blurple/80 font-semibold">App Settings</p>
                                        <h2 className="text-2xl font-semibold text-white mt-2">Accessibility</h2>
                                        <p className="text-sm text-discord-faint mt-2">Accessibility options tuned to the current dark interface.</p>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Text size</p>
                                                <p className="text-xs text-discord-faint mt-1">Increase text size for readability.</p>
                                            </div>
                                            <div className="text-xs text-discord-faint">Default</div>
                                        </div>
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Color contrast</p>
                                                <p className="text-xs text-discord-faint mt-1">Use the existing high-contrast Discord palette.</p>
                                            </div>
                                            <div className="text-xs text-discord-faint">High</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'language' && (
                            <div className="px-5 sm:px-8 py-12">
                                <div className="max-w-3xl">
                                    <h2 className="text-xl font-semibold text-white">Select a Language</h2>
                                    <p className="text-sm text-discord-faint mt-2">
                                        Choose the language you want CircleCore to display.
                                    </p>
                                    <div className="mt-6 rounded-xl border border-discord-border/60 bg-discord-darkest/80 px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-7 rounded-sm overflow-hidden border border-discord-border/60 bg-discord-darkest flex items-center justify-center text-[10px] font-semibold">
                                                US
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">English, US</p>
                                                <p className="text-xs text-discord-faint">English, US</p>
                                            </div>
                                        </div>
                                        <div className="text-discord-faint text-sm">English, US</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'security' && (
                            <div className="px-5 sm:px-8 py-8">
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="rounded-3xl border border-discord-border/60 bg-discord-darkest/80 p-6 md:p-8">
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div>
                                                <p className="text-[11px] uppercase tracking-[0.3em] text-blurple/80 font-semibold">Account Security</p>
                                                <h2 className="text-2xl font-semibold text-white mt-2">Two-factor authentication</h2>
                                                <p className="text-sm text-discord-faint mt-2 max-w-2xl">
                                                    Use an authenticator app for an extra sign-in step. This protects your account even if your password is exposed.
                                                </p>
                                            </div>
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${user?.twoFactorEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-discord-darkest border-discord-border text-discord-faint'}`}>
                                                {user?.twoFactorEnabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                                                {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                                            </div>
                                        </div>

                                        {twoFactorError && (
                                            <div className="mt-5 px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium">
                                                {twoFactorError}
                                            </div>
                                        )}
                                        {twoFactorMessage && (
                                            <div className="mt-5 px-4 py-3 bg-discord-green/10 border border-discord-green/20 rounded-lg text-sm text-discord-green font-medium">
                                                {twoFactorMessage}
                                            </div>
                                        )}

                                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
                                            <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 p-4 flex items-center justify-center min-h-[260px]">
                                                {twoFactorSetup?.qrCodeDataUrl ? (
                                                    <img src={twoFactorSetup.qrCodeDataUrl} alt="2FA QR code" className="w-56 h-56 rounded-xl border border-discord-border/60 bg-white p-2" />
                                                ) : (
                                                    <div className="text-center space-y-3">
                                                        <QrCode className="w-12 h-12 text-discord-faint mx-auto" />
                                                        <p className="text-sm text-discord-faint">Generate a QR code to start 2FA setup.</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 p-4">
                                                    <p className="text-sm font-semibold text-white">Setup flow</p>
                                                    <p className="text-xs text-discord-faint mt-1">
                                                        1. Generate a secret. 2. Scan the QR code in an authenticator app. 3. Enter the 6-digit code to confirm.
                                                    </p>
                                                    {twoFactorSetup?.manualEntryKey && (
                                                        <div className="mt-4 rounded-xl border border-discord-border/60 bg-discord-darkest px-3 py-2 text-xs text-discord-light break-all">
                                                            {twoFactorSetup.manualEntryKey}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={handleTwoFactorSetup}
                                                        disabled={twoFactorBusy}
                                                        className="px-4 py-2 rounded-lg bg-blurple text-white text-sm font-semibold hover:bg-blurple/90 disabled:opacity-60"
                                                    >
                                                        {twoFactorBusy ? 'Working…' : 'Generate QR Code'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleTwoFactorEnable}
                                                        disabled={twoFactorBusy || !twoFactorSetup?.secret || !twoFactorCode.trim()}
                                                        className="px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/20 disabled:opacity-60"
                                                    >
                                                        Enable 2FA
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleTwoFactorDisable}
                                                        disabled={twoFactorBusy || !user?.twoFactorEnabled || !twoFactorCode.trim()}
                                                        className="px-4 py-2 rounded-lg border border-discord-red/30 bg-discord-red/10 text-discord-red text-sm font-semibold hover:bg-discord-red/20 disabled:opacity-60"
                                                    >
                                                        Disable 2FA
                                                    </button>
                                                </div>

                                                <div className="space-y-2 max-w-sm">
                                                    <label className="text-sm font-semibold text-discord-light">Authenticator Code</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                        value={twoFactorCode}
                                                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        placeholder="123456"
                                                        className="w-full rounded-lg border border-discord-border/60 bg-discord-darkest px-4 py-2.5 text-white outline-none focus:border-blurple"
                                                    />
                                                    <p className="text-xs text-discord-faint">
                                                        Use the same code to confirm setup or disable 2FA.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'privacy' && (
                            <div className="px-5 sm:px-8 py-8">
                                <h2 className="text-xl font-semibold text-white text-center mb-8">How CircleCore Uses Your Data</h2>
                                <div className="space-y-6 max-w-3xl mx-auto">
                                    {[
                                        {
                                            key: 'improveData',
                                            title: 'Use data to improve CircleCore',
                                            desc: 'Allows us to use and process your information to understand and improve our services.',
                                        },
                                        {
                                            key: 'personalizeActivity',
                                            title: 'Use my activity to personalize Sponsored Content',
                                            desc: 'Allows us to personalize Sponsored Content using your activity, such as the communities you join.',
                                        },
                                        {
                                            key: 'thirdPartyPersonalization',
                                            title: 'Use third-party data to personalize Sponsored Content',
                                            desc: 'Allows us to personalize Sponsored Content using data we receive from third parties.',
                                        },
                                        {
                                            key: 'personalizeExperience',
                                            title: 'Use data to personalize my CircleCore experience',
                                            desc: 'Allows us to use information such as who you talk to and what you do to personalize CircleCore for you.',
                                        },
                                        {
                                            key: 'voiceClips',
                                            title: 'Allow my voice to be recorded in Clips',
                                            desc: 'By turning on this setting, your voice may be included when someone in the same voice channel uses Clips.',
                                        },
                                    ].map((item) => (
                                        <div key={item.key} className="flex items-start justify-between gap-6">
                                            <div>
                                                <p className="text-sm font-semibold text-discord-light">{item.title}</p>
                                                <p className="text-xs text-discord-faint mt-1">
                                                    {item.desc}{' '}
                                                    <a href="/help" className="text-blurple hover:underline">Learn more</a>
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setPrivacy((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                                    privacy[item.key] ? 'bg-blurple' : 'bg-discord-darkest'
                                                }`}
                                            >
                                                <span className={`absolute top-0.5 ${privacy[item.key] ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all`} />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="pt-4 border-t border-discord-border/50 text-xs text-discord-faint">
                                        We need to store and process data to provide the basic CircleCore service. You can disable or delete your account anytime.
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'community' && (
                            <div className="px-5 sm:px-8 py-8">
                                <div className="max-w-5xl mx-auto space-y-6">
                                    <div className="rounded-3xl border border-discord-border/60 bg-gradient-to-br from-[#1f2230] via-[#232734] to-[#1a1d27] p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-[0_18px_45px_rgba(10,12,20,0.45)]">
                                        <div className="space-y-3">
                                            <p className="text-[11px] uppercase tracking-[0.35em] text-blurple/80 font-semibold">Community Essentials</p>
                                            <h2 className="text-2xl md:text-3xl font-semibold text-white">
                                                Communities thrive when trust, invite-only access, and real-time presence work together.
                                            </h2>
                                            <p className="text-sm text-discord-faint max-w-2xl">
                                                CircleCore is built for shared purpose - invite-only servers, member-first moderation, and live presence that makes your space feel active and safe.
                                                <a href="/help" className="text-blurple ml-1 hover:underline">Learn more</a>
                                            </p>
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {['Invite-Only', 'Member-First', 'Real-Time', 'Trust & Safety'].map((chip) => (
                                                    <span key={chip} className="px-3 py-1 rounded-full text-[11px] font-semibold bg-discord-darkest/80 border border-discord-border/60 text-discord-light">
                                                        {chip}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-full lg:w-[260px] h-[160px] rounded-2xl bg-gradient-to-br from-blurple/40 via-indigo-500/20 to-emerald-400/20 border border-white/5 flex items-center justify-center text-sm font-semibold text-discord-light">
                                            Community First
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { title: 'Invite-Only by Default', text: 'Keep spaces intentional. New members arrive through trusted invites and approvals.' },
                                            { title: 'Shared Culture', text: 'Channels and roles reinforce your group\'s vibe so newcomers learn fast.' },
                                            { title: 'Live Presence', text: 'See who\'s active in real time - text, voice, and community moments.' },
                                        ].map((card) => (
                                            <div key={card.title} className="rounded-2xl border border-discord-border/60 bg-discord-darkest/80 p-5 hover:border-blurple/60 transition-colors">
                                                <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                                                <p className="text-xs text-discord-faint mt-2">{card.text}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/80 p-6 space-y-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-white">What makes a CircleCore community feel different?</h3>
                                            <p className="text-xs text-discord-faint mt-2">
                                                We focus on healthy engagement and clarity - so members know where to go, who to trust, and how to contribute.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {[
                                                { title: 'Purpose-built channels', text: 'Spaces for hangouts, collaboration, and focus - not just endless chat.' },
                                                { title: 'Invite-only access', text: 'Share a code, approve requests, and keep your community curated.' },
                                                { title: 'Roles with meaning', text: 'Reward participation and create structure that scales with your group.' },
                                                { title: 'Real-time visibility', text: 'See who\'s active across text and voice without clicking around.' },
                                            ].map((row) => (
                                                <div key={row.title} className="rounded-xl border border-discord-border/60 bg-discord-darkest/70 p-4">
                                                    <p className="text-sm font-semibold text-white">{row.title}</p>
                                                    <p className="text-xs text-discord-faint mt-1">{row.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="md:hidden px-5 pb-8">
                            <button
                                onClick={handleSignOut}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-discord-red hover:bg-discord-darkest/60"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettingsModal;
