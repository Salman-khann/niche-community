import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Pencil, X, LogOut, Camera, ShieldCheck, ShieldAlert, QrCode } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useFeedStore } from '../stores/feedStore';
import { useNotificationStore } from '../stores/notificationStore';
import { getUserPreferences, saveUserPreferences } from '../utils/userPreferences';
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
    const { logout, changePassword, getTwoFactorSetup, enableTwoFactor, disableTwoFactor, regenerateRecoveryCodes, logoutAll } = useAuthStore();
    const { prefs: notificationPrefs, fetchPrefs: fetchNotificationPrefs, updatePrefs: updateNotificationPrefs } = useNotificationStore();
    const storedPreferences = useMemo(() => getUserPreferences(), []);
    const initial = useMemo(() => ({
        displayName: profile?.displayName || user?.name || '',
        pronouns: profile?.pronouns || '',
        bannerColor: profile?.bannerColor || '#3f4f4f',
        bio: profile?.bio || '',
        avatar: profile?.avatar || '',
    }), [profile, user]);

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
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [twoFactorBusy, setTwoFactorBusy] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [notificationBusy, setNotificationBusy] = useState(false);
    const [notificationError, setNotificationError] = useState('');
    const [notificationMessage, setNotificationMessage] = useState('');
    const [voiceMode, setVoiceMode] = useState(storedPreferences.voice.inputMode || 'voice');
    const [noiseSuppression, setNoiseSuppression] = useState(storedPreferences.voice.noiseSuppression ?? true);
    const [cameraPreview, setCameraPreview] = useState(storedPreferences.voice.cameraPreview ?? true);
    const [autoplayMedia, setAutoplayMedia] = useState(storedPreferences.voice.autoplayMedia ?? true);
    const [cameraDeviceId, setCameraDeviceId] = useState(storedPreferences.voice.cameraDeviceId || '');
    const [pttKeybind, setPttKeybind] = useState('No Keybind Set');
    const [isRecordingKeybind, setIsRecordingKeybind] = useState(false);
    const [cameraDevices, setCameraDevices] = useState([]);
    const [microphoneDevices, setMicrophoneDevices] = useState([]);
    const [speakerDevices, setSpeakerDevices] = useState([]);
    const [micDeviceId, setMicDeviceId] = useState('');
    const [speakerDeviceId, setSpeakerDeviceId] = useState('');
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micVolumeLevel, setMicVolumeLevel] = useState(0);
    const [isTestingVideo, setIsTestingVideo] = useState(false);
    const [videoStream, setVideoStream] = useState(null);
    const videoPreviewRef = useRef(null);
    const micTestRef = useRef({ audioContext: null, analyser: null, source: null, stream: null, rafId: null });
    const [appearanceTheme, setAppearanceTheme] = useState(storedPreferences.appearance.theme || 'dark');
    const [reduceMotion, setReduceMotion] = useState(storedPreferences.appearance.reduceMotion ?? false);
    const [textSize, setTextSize] = useState(storedPreferences.accessibility.textSize || 'medium');
    const [colorContrast, setColorContrast] = useState(storedPreferences.accessibility.contrast || 'normal');
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
        const prefs = getUserPreferences();
        setVoiceMode(prefs.voice.inputMode || 'voice');
        setNoiseSuppression(prefs.voice.noiseSuppression ?? true);
        setCameraPreview(prefs.voice.cameraPreview ?? true);
        setAutoplayMedia(prefs.voice.autoplayMedia ?? true);
        setCameraDeviceId(prefs.voice.cameraDeviceId || '');
        setAppearanceTheme(prefs.appearance.theme || 'dark');
        setReduceMotion(prefs.appearance.reduceMotion ?? false);
        setTextSize(prefs.accessibility.textSize || 'medium');
        setColorContrast(prefs.accessibility.contrast || 'normal');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        setPasswordMessage('');
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
        setRecoveryCodes([]);
        setNotificationError('');
        setNotificationMessage('');
        fetchNotificationPrefs().catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initial]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const loadMediaDevices = async () => {
            if (!navigator.mediaDevices?.enumerateDevices) {
                setCameraDevices([]);
                setMicrophoneDevices([]);
                setSpeakerDevices([]);
                return;
            }
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                if (cancelled) return;
                
                const videoInputs = [];
                const audioInputs = [];
                const audioOutputs = [];

                devices.forEach((device) => {
                    if (device.kind === 'videoinput') {
                        videoInputs.push({ deviceId: device.deviceId, label: device.label || `Camera ${videoInputs.length + 1}` });
                    } else if (device.kind === 'audioinput') {
                        audioInputs.push({ deviceId: device.deviceId, label: device.label || `Microphone ${audioInputs.length + 1}` });
                    } else if (device.kind === 'audiooutput') {
                        audioOutputs.push({ deviceId: device.deviceId, label: device.label || `Speaker ${audioOutputs.length + 1}` });
                    }
                });

                setCameraDevices(videoInputs);
                setMicrophoneDevices(audioInputs);
                setSpeakerDevices(audioOutputs);
                
                if (!cameraDeviceId && videoInputs[0]?.deviceId) {
                    setCameraDeviceId(videoInputs[0].deviceId);
                    saveUserPreferences({ voice: { cameraDeviceId: videoInputs[0].deviceId } });
                }
                if (!micDeviceId && audioInputs[0]?.deviceId) setMicDeviceId(audioInputs[0].deviceId);
                if (!speakerDeviceId && audioOutputs[0]?.deviceId) setSpeakerDeviceId(audioOutputs[0].deviceId);
                
            } catch {
                if (!cancelled) {
                    setCameraDevices([]);
                    setMicrophoneDevices([]);
                    setSpeakerDevices([]);
                }
            }
        };

        loadMediaDevices();

        const handleDeviceChange = () => {
            loadMediaDevices();
        };

        navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
        return () => {
            cancelled = true;
            navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, cameraDeviceId]);

    useEffect(() => {
        if (!isRecordingKeybind) return;

        const handleKeyDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            let keyName = e.key.toUpperCase();
            if (keyName === ' ') keyName = 'SPACE';
            setPttKeybind(keyName);
            setIsRecordingKeybind(false);
        };

        const handleMouseDown = (e) => {
            if (e.target.closest && e.target.closest('.keybind-stop-btn')) {
                // If they explicitly clicked the 'Stop Recording' button, we let it hit and just abort without bind override
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const btnName = `MOUSE${parseInt(e.button) + 1}`;
            setPttKeybind(btnName);
            setIsRecordingKeybind(false);
        };

        const handleContextMenu = (e) => { e.preventDefault(); };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.addEventListener('mousedown', handleMouseDown, { capture: true });
        window.addEventListener('contextmenu', handleContextMenu, { capture: true });

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.removeEventListener('mousedown', handleMouseDown, { capture: true });
            window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
        };
    }, [isRecordingKeybind]);

    useEffect(() => {
        return () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
            if (micTestRef.current?.stream) {
                micTestRef.current.stream.getTracks().forEach(track => track.stop());
            }
            if (micTestRef.current?.rafId) {
                cancelAnimationFrame(micTestRef.current.rafId);
            }
            if (micTestRef.current?.audioContext && micTestRef.current.audioContext.state !== 'closed') {
                micTestRef.current.audioContext.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (videoPreviewRef.current && videoStream) {
            videoPreviewRef.current.srcObject = videoStream;
        }
    }, [videoStream, isTestingVideo]);

    const toggleVideoTest = async () => {
        if (isTestingVideo) {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
                setVideoStream(null);
            }
            setIsTestingVideo(false);
        } else {
            setIsTestingVideo(true);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true
                });
                setVideoStream(stream);
            } catch (err) {
                console.error("Video test failed:", err);
                setIsTestingVideo(false);
            }
        }
    };

    const toggleMicTest = async () => {
        if (isTestingMic) {
            setIsTestingMic(false);
            setMicVolumeLevel(0);
            if (micTestRef.current?.stream) {
                micTestRef.current.stream.getTracks().forEach(track => track.stop());
            }
            if (micTestRef.current?.rafId) {
                cancelAnimationFrame(micTestRef.current.rafId);
            }
            if (micTestRef.current?.audioContext && micTestRef.current.audioContext.state !== 'closed') {
                micTestRef.current.audioContext.close();
            }
            micTestRef.current = { audioContext: null, analyser: null, source: null, stream: null, rafId: null };
        } else {
            setIsTestingMic(true);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true
                });
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                
                const updateVolume = () => {
                    analyser.getByteFrequencyData(dataArray);
                    let max = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        if (dataArray[i] > max) max = dataArray[i];
                    }
                    setMicVolumeLevel(max);
                    micTestRef.current.rafId = requestAnimationFrame(updateVolume);
                };
                
                updateVolume();

                micTestRef.current = { audioContext, analyser, source, stream, rafId: micTestRef.current?.rafId };
            } catch (err) {
                console.error("Mic test failed:", err);
                setIsTestingMic(false);
            }
        }
    };

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
        } catch {
            // ignore
        }
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
            const data = await enableTwoFactor(twoFactorSetup.secret, twoFactorCode);
            setTwoFactorMessage('Two-factor authentication is now enabled. Please save your recovery codes!');
            setRecoveryCodes(data.recoveryCodes || []);
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

    const handleRegenerateRecoveryCodes = async () => {
        setTwoFactorBusy(true);
        setTwoFactorError('');
        setTwoFactorMessage('');
        try {
            const data = await regenerateRecoveryCodes();
            setRecoveryCodes(data.recoveryCodes || []);
            setTwoFactorMessage('New recovery codes generated.');
        } catch (error) {
            setTwoFactorError(error.message || 'Unable to regenerate recovery codes');
        } finally {
            setTwoFactorBusy(false);
        }
    };

    const handleLogoutAll = async () => {
        if (!window.confirm('Are you sure you want to log out of all other devices? This will invalidate all active sessions.')) return;
        setTwoFactorBusy(true);
        try {
            await logoutAll();
            setTwoFactorMessage('All other devices have been logged out.');
        } catch (error) {
            setTwoFactorError(error.message || 'Unable to logout from all devices');
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

    const handleVoiceSettingChange = (partial) => {
        if (partial.voiceMode !== undefined) setVoiceMode(partial.voiceMode);
        if (partial.noiseSuppression !== undefined) setNoiseSuppression(partial.noiseSuppression);
        if (partial.cameraPreview !== undefined) setCameraPreview(partial.cameraPreview);
        if (partial.autoplayMedia !== undefined) setAutoplayMedia(partial.autoplayMedia);
        if (partial.cameraDeviceId !== undefined) setCameraDeviceId(partial.cameraDeviceId);
        saveUserPreferences({
            voice: {
                inputMode: partial.voiceMode !== undefined ? partial.voiceMode : voiceMode,
                noiseSuppression: partial.noiseSuppression !== undefined ? partial.noiseSuppression : noiseSuppression,
                cameraPreview: partial.cameraPreview !== undefined ? partial.cameraPreview : cameraPreview,
                autoplayMedia: partial.autoplayMedia !== undefined ? partial.autoplayMedia : autoplayMedia,
                cameraDeviceId: partial.cameraDeviceId !== undefined ? partial.cameraDeviceId : cameraDeviceId,
            },
        });
    };

    const handleAppearanceChange = (partial) => {
        if (partial.theme !== undefined) setAppearanceTheme(partial.theme);
        if (partial.reduceMotion !== undefined) setReduceMotion(partial.reduceMotion);
        saveUserPreferences({
            appearance: {
                theme: partial.theme !== undefined ? partial.theme : appearanceTheme,
                reduceMotion: partial.reduceMotion !== undefined ? partial.reduceMotion : reduceMotion,
            },
        });
    };

    const handleAccessibilityChange = (partial) => {
        if (partial.textSize !== undefined) setTextSize(partial.textSize);
        if (partial.contrast !== undefined) setColorContrast(partial.contrast);
        saveUserPreferences({
            accessibility: {
                textSize: partial.textSize !== undefined ? partial.textSize : textSize,
                contrast: partial.contrast !== undefined ? partial.contrast : colorContrast,
            },
        });
    };

    const handleChangePassword = async () => {
        setPasswordError('');
        setPasswordMessage('');

        if (!currentPassword.trim() || !newPassword.trim()) {
            setPasswordError('Enter your current password and a new password.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('The new passwords do not match.');
            return;
        }

        setPasswordBusy(true);
        try {
            const result = await changePassword(currentPassword, newPassword);
            setPasswordMessage(result?.message || 'Password changed successfully.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setPasswordError(error.message || 'Unable to change password.');
        } finally {
            setPasswordBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="absolute inset-0 md:inset-[5vh] rounded-none md:rounded-2xl bg-[#202024] shadow-2xl border border-discord-border/60 overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-full w-full grid grid-cols-1 md:grid-cols-[280px_1fr]">
                    <aside className="hidden md:flex h-full bg-[#121214] border-r border-discord-border/50 px-4 py-5 flex-col gap-5 overflow-y-auto">
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
                                    <p className="text-xs text-discord-faint mt-2">
                                        Manage your profile, password, and account-level preferences here.
                                    </p>
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

                        {activeSection === 'account' && (
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
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection('security')}
                                                    className="w-full py-2 rounded-lg bg-blurple text-white text-sm font-semibold"
                                                >
                                                    Open Security
                                                </button>
                                            </div>

                                            <div className="mt-4 rounded-xl border border-discord-border/60 bg-discord-darkest/70 p-4 space-y-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">Account management</p>
                                                    <p className="text-xs text-discord-faint mt-1">
                                                        Manage sign-in details, password security, and recovery settings.
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 text-xs text-discord-light">
                                                    <div className="flex items-center justify-between gap-3 rounded-lg bg-discord-darker px-3 py-2">
                                                        <span>Email</span>
                                                        <span className="text-discord-faint">{user?.email || 'Not available'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 rounded-lg bg-discord-darker px-3 py-2">
                                                        <span>Account status</span>
                                                        <span className="text-emerald-300">{user?.isVerified ? 'Verified' : 'Unverified'}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection('security')}
                                                    className="w-full rounded-lg bg-discord-border-light/30 px-3 py-2 text-sm font-semibold text-white hover:bg-discord-border-light/50"
                                                >
                                                    Manage Password & Security
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-discord-border/60 bg-discord-darkest/80 p-6 md:p-8 space-y-4">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-[0.3em] text-blurple/80 font-semibold">Account Security</p>
                                            <h3 className="text-xl font-semibold text-white mt-2">Password management</h3>
                                            <p className="text-sm text-discord-faint mt-2 max-w-2xl">
                                                Update your password without leaving settings. This refreshes your session after the change.
                                            </p>
                                        </div>

                                        {passwordError && (
                                            <div className="px-4 py-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red font-medium">
                                                {passwordError}
                                            </div>
                                        )}
                                        {passwordMessage && (
                                            <div className="px-4 py-3 bg-discord-green/10 border border-discord-green/20 rounded-lg text-sm text-discord-green font-medium">
                                                {passwordMessage}
                                            </div>
                                        )}

                                        <div className="grid gap-3">
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Current password"
                                                className="w-full rounded-lg border border-discord-border/60 bg-discord-darkest px-4 py-2.5 text-white outline-none focus:border-blurple"
                                            />
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="New password"
                                                className="w-full rounded-lg border border-discord-border/60 bg-discord-darkest px-4 py-2.5 text-white outline-none focus:border-blurple"
                                            />
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password"
                                                className="w-full rounded-lg border border-discord-border/60 bg-discord-darkest px-4 py-2.5 text-white outline-none focus:border-blurple"
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={handleChangePassword}
                                                disabled={passwordBusy}
                                                className="px-4 py-2 rounded-lg bg-blurple text-white text-sm font-semibold hover:bg-blurple/90 disabled:opacity-60"
                                            >
                                                {passwordBusy ? 'Updating...' : 'Change Password'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveSection('account')}
                                                className="px-4 py-2 rounded-lg border border-discord-border/60 bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/20"
                                            >
                                                Back to Account
                                            </button>
                                        </div>
                                    </div>
                                </div>
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
                                <div className="max-w-3xl mx-auto pb-10">
                                    <h2 className="text-[16px] font-bold text-discord-white mb-6">Voice & Video</h2>

                                    <div className="space-y-8">
                                        {/* Voice Section */}
                                        <div className="space-y-6">
                                            <h3 className="text-xl font-medium text-white">Voice</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                                <div>
                                                    <label className="block text-[12px] font-bold text-discord-light mb-2">Microphone</label>
                                                    <select
                                                        value={micDeviceId}
                                                        onChange={(e) => setMicDeviceId(e.target.value)}
                                                        className="w-full bg-[#1e1f22] border border-[#1e1f22] text-discord-white rounded-[4px] px-3 py-2 outline-none focus:border-blurple text-[14px]"
                                                    >
                                                        {microphoneDevices.map((device) => (
                                                            <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                                                        ))}
                                                        {microphoneDevices.length === 0 && <option value="">Default Microphone</option>}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[12px] font-bold text-discord-light mb-2">Speaker</label>
                                                    <select
                                                        value={speakerDeviceId}
                                                        onChange={(e) => setSpeakerDeviceId(e.target.value)}
                                                        className="w-full bg-[#1e1f22] border border-[#1e1f22] text-discord-white rounded-[4px] px-3 py-2 outline-none focus:border-blurple text-[14px]"
                                                    >
                                                        {speakerDevices.map((device) => (
                                                            <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                                                        ))}
                                                        {speakerDevices.length === 0 && <option value="">Default Speaker</option>}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[12px] font-bold text-discord-light mb-2">Microphone Volume</label>
                                                    <input type="range" min="0" max="100" defaultValue="80" className="w-full mt-1 accent-white bg-blurple rounded-full appearance-none h-1.5" />
                                                </div>
                                                <div>
                                                    <label className="block text-[12px] font-bold text-discord-light mb-2">Speaker Volume</label>
                                                    <input type="range" min="0" max="100" defaultValue="60" className="w-full mt-1 accent-white bg-blurple rounded-full appearance-none h-1.5" />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 mt-6">
                                                <button 
                                                    className={`text-white font-medium px-6 py-2 rounded-[4px] text-[14px] ${isTestingMic ? 'bg-red-500 hover:bg-red-600' : 'bg-blurple hover:bg-blurple/90'}`}
                                                    onClick={toggleMicTest}
                                                >
                                                    {isTestingMic ? 'Stop Testing' : 'Mic Test'}
                                                </button>
                                                <div className="flex-1 h-6 flex items-center gap-[2px]">
                                                    {Array.from({ length: 70 }).map((_, i) => {
                                                        const threshold = (i / 70) * 255;
                                                        const isActive = isTestingMic && micVolumeLevel > threshold;
                                                        return (
                                                            <div key={i} className={`flex-1 h-full rounded-[1px] transition-colors duration-[50ms] ${isActive ? 'bg-discord-green' : 'bg-discord-border/40'}`}></div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-[1px] bg-discord-border/30 w-full my-6" />

                                        {/* Input Mode */}
                                        <div className="space-y-4">
                                            <h3 className="text-[16px] font-semibold text-white mb-3">Input Mode</h3>
                                            <div className="space-y-4">
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <div className={`w-5 h-5 rounded-full border-[2px] flex items-center justify-center ${voiceMode === 'voice' ? 'border-discord-white' : 'border-discord-faint group-hover:border-discord-light'}`}>
                                                        {voiceMode === 'voice' && <div className="w-2.5 h-2.5 bg-discord-white rounded-full" />}
                                                    </div>
                                                    <span className="text-discord-white font-medium text-[15px]">Voice Activity</span>
                                                    <input type="radio" value="voice" checked={voiceMode === 'voice'} onChange={(e) => handleVoiceSettingChange({ voiceMode: e.target.value })} className="hidden" />
                                                </label>
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <div className={`w-5 h-5 rounded-full border-[2px] flex items-center justify-center ${voiceMode === 'ptt' ? 'border-discord-white' : 'border-discord-faint group-hover:border-discord-light'}`}>
                                                        {voiceMode === 'ptt' && <div className="w-2.5 h-2.5 bg-discord-white rounded-full" />}
                                                    </div>
                                                    <span className="text-discord-white font-medium text-[15px]">Push to Talk</span>
                                                    <input type="radio" value="ptt" checked={voiceMode === 'ptt'} onChange={(e) => handleVoiceSettingChange({ voiceMode: e.target.value })} className="hidden" />
                                                </label>
                                            </div>
                                            
                                            {voiceMode === 'ptt' && (
                                                <div className="mt-6">
                                                    <label className="block text-[12px] font-bold text-discord-light mb-2">SHORTCUT</label>
                                                    <div className="flex items-stretch max-w-sm">
                                                        <div 
                                                            className={`flex-1 border bg-[#1e1f22] rounded-l-[4px] px-3 py-2 text-[14px] flex items-center border-r-0 ${isRecordingKeybind ? 'border-blurple text-blurple shadow-[0_0_0_1px_#5865F2]' : 'border-discord-darker text-discord-white'} cursor-pointer`}
                                                            onClick={() => setIsRecordingKeybind(!isRecordingKeybind)}
                                                        >
                                                            {isRecordingKeybind ? 'Recording...' : pttKeybind}
                                                        </div>
                                                        <button 
                                                            className="keybind-stop-btn text-[14px] px-6 py-2 border border-discord-darker bg-[#2b2d31] text-discord-white hover:bg-discord-border/30 rounded-r-[4px] font-medium"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsRecordingKeybind(!isRecordingKeybind);
                                                            }}
                                                        >
                                                            {isRecordingKeybind ? 'Stop Recording' : 'Record Keybind'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="h-[1px] bg-discord-border/30 w-full my-8" />

                                        {/* Camera Section */}
                                        <div className="space-y-6">
                                            <h3 className="text-xl font-medium text-white mb-2">Camera</h3>
                                            
                                            <div className="relative w-full max-w-3xl h-[280px] bg-[#111214] rounded-[8px] flex items-center justify-center overflow-hidden">
                                                {videoStream && (
                                                    <video 
                                                        ref={videoPreviewRef} 
                                                        autoPlay 
                                                        playsInline 
                                                        muted 
                                                        className="absolute inset-0 w-full h-full object-cover" 
                                                    />
                                                )}
                                                <button 
                                                    onClick={toggleVideoTest}
                                                    className={`z-10 text-white font-medium px-6 py-2 rounded-[4px] text-[14px] ${isTestingVideo ? 'bg-red-500 hover:bg-red-600' : 'bg-blurple hover:bg-blurple/90'}`}
                                                >
                                                    {isTestingVideo ? 'Stop Testing' : 'Test Video'}
                                                </button>
                                            </div>

                                            <div className="max-w-3xl pt-2">
                                                <label className="block text-[12px] font-bold text-discord-light mb-2">Camera</label>
                                                <select
                                                    value={cameraDeviceId}
                                                    onChange={(e) => handleVoiceSettingChange({ cameraDeviceId: e.target.value })}
                                                    className="w-full bg-[#1e1f22] border border-[#1e1f22] text-discord-white rounded-[4px] px-3 py-2 outline-none focus:border-blurple text-[14px] mb-2"
                                                >
                                                    {cameraDevices.map((device) => (
                                                        <option key={device.deviceId} value={device.deviceId}>
                                                            {device.label}
                                                        </option>
                                                    ))}
                                                    {cameraDevices.length === 0 && <option value="">Default Camera</option>}
                                                </select>
                                                <p className="text-[13px] text-discord-faint">
                                                    Looking for more camera options? <a href="#" className="text-blurple hover:underline">Check out your system camera settings.</a>
                                                </p>
                                            </div>
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
                                                <p className="text-xs text-discord-faint mt-1">Change the app shell, accent, and background treatment.</p>
                                            </div>
                                            <select value={appearanceTheme} onChange={(e) => handleAppearanceChange({ theme: e.target.value })} className="rounded-lg border border-discord-border/60 bg-[#1e1f22] px-3 py-2 text-sm text-discord-light outline-none">
                                                <option value="dark">Dark</option>
                                                <option value="darker">Darker</option>
                                                <option value="aurora">Aurora</option>
                                            </select>
                                        </div>
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">Theme preview</p>
                                                    <p className="text-xs text-discord-faint mt-1">The selected theme updates the shared color tokens used across the app.</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {['dark', 'darker', 'aurora'].map((theme) => (
                                                        <button
                                                            key={theme}
                                                            type="button"
                                                            onClick={() => handleAppearanceChange({ theme })}
                                                            className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize border ${appearanceTheme === theme ? 'border-blurple bg-blurple/15 text-white' : 'border-discord-border/60 bg-discord-darkest text-discord-faint hover:bg-discord-border-light/20'}`}
                                                        >
                                                            {theme}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {(() => {
                                                const styles = {
                                                    dark: { surface: 'bg-[#313338] text-white border-transparent', accent: 'bg-[#5865F2]/20 border-[#5865F2]/50 text-[#5865F2]', glow: 'bg-[#2B2D31] text-[#B5BAC1] border-transparent' },
                                                    darker: { surface: 'bg-[#111214] text-white border-transparent', accent: 'bg-[#5865F2]/20 border-[#5865F2]/50 text-[#5865F2]', glow: 'bg-[#1E1F22] text-[#B5BAC1] border-transparent' },
                                                    aurora: { surface: 'bg-gradient-to-br from-[#1c2c36] to-[#0d161b] text-white border-transparent', accent: 'bg-[#40b1ac]/20 border-[#40b1ac]/50 text-[#40b1ac]', glow: 'bg-[#142028] text-[#90b8c0] border-transparent' }
                                                };
                                                const current = styles[appearanceTheme] || styles.dark;
                                                return (
                                                    <div className="mt-4 grid grid-cols-3 gap-3">
                                                        <div className={`h-14 rounded-xl border flex items-center justify-center text-xs font-medium ${current.surface}`}>Surface</div>
                                                        <div className={`h-14 rounded-xl border flex items-center justify-center text-xs font-medium ${current.accent}`}>Accent</div>
                                                        <div className={`h-14 rounded-xl border flex items-center justify-center text-xs font-medium ${current.glow}`}>Glow</div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Reduce motion</p>
                                                <p className="text-xs text-discord-faint mt-1">Minimize animated transitions across the app.</p>
                                            </div>
                                            <button type="button" onClick={() => handleAppearanceChange({ reduceMotion: !reduceMotion })} className={`relative w-12 h-6 rounded-full transition-colors ${reduceMotion ? 'bg-blurple' : 'bg-discord-darkest'}`}>
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
                                            <select value={textSize} onChange={(e) => handleAccessibilityChange({ textSize: e.target.value })} className="rounded-lg border border-discord-border/60 bg-[#1e1f22] px-3 py-2 text-sm text-discord-light outline-none">
                                                <option value="small">Small</option>
                                                <option value="medium">Medium</option>
                                                <option value="large">Large</option>
                                                <option value="xlarge">Extra Large</option>
                                            </select>
                                        </div>
                                        <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 px-4 py-4 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Color contrast</p>
                                                <p className="text-xs text-discord-faint mt-1">Improve readability across the app shell.</p>
                                            </div>
                                            <select value={colorContrast} onChange={(e) => handleAccessibilityChange({ contrast: e.target.value })} className="rounded-lg border border-discord-border/60 bg-[#1e1f22] px-3 py-2 text-sm text-discord-light outline-none">
                                                <option value="normal">Normal</option>
                                                <option value="high">High</option>
                                                <option value="extra">Extra High</option>
                                            </select>
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

                                        {user?.twoFactorEnabled && (
                                            <div className="mt-8 pt-8 border-t border-discord-border/50">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-white">Recovery Codes</h4>
                                                        <p className="text-xs text-discord-faint mt-1">
                                                            If you lose your phone, you can use these codes to log in. Each code can only be used once.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleRegenerateRecoveryCodes}
                                                        disabled={twoFactorBusy}
                                                        className="text-xs font-semibold text-blurple hover:underline"
                                                    >
                                                        Regenerate Codes
                                                    </button>
                                                </div>

                                                {recoveryCodes.length > 0 ? (
                                                    <div className="rounded-2xl border border-discord-border/60 bg-discord-darkest/70 p-4">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {recoveryCodes.map((code, idx) => (
                                                                <div key={idx} className="font-mono text-xs text-white bg-discord-darker px-3 py-1.5 rounded border border-discord-border/40 select-all transition-all hover:bg-discord-border/10">
                                                                    {code}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const text = recoveryCodes.join('\n');
                                                                const blob = new Blob([`CIRCLECORE RECOVERY CODES\nAccount: ${user?.email}\nGenerated: ${new Date().toLocaleString()}\n\n${text}\n\nKeep these secret and store them in a safe place.`], { type: 'text/plain' });
                                                                const url = URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = `circlecore_recovery_codes_${user?._id?.slice(-4)}.txt`;
                                                                a.click();
                                                                URL.revokeObjectURL(url);
                                                            }}
                                                            className="mt-4 w-full py-2 rounded-lg bg-discord-darker hover:bg-discord-border-light/20 text-xs font-semibold text-white transition-colors"
                                                        >
                                                            Download Codes (.txt)
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-6 rounded-2xl border border-dashed border-discord-border/60">
                                                        <p className="text-xs text-discord-faint">No codes to display. Generate new ones above if needed.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-8 pt-8 border-t border-discord-border/50">
                                            <h4 className="text-sm font-semibold text-white mb-2">Session Management</h4>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <p className="text-xs text-discord-faint">
                                                        Logged in as <b>{user?.email}</b>. If you suspect your account has been compromised, you can terminate all other active sessions across different devices.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleLogoutAll}
                                                    disabled={twoFactorBusy}
                                                    className="shrink-0 px-4 py-2 rounded-lg border border-discord-red/40 bg-discord-red/5 text-discord-red text-sm font-semibold hover:bg-discord-red/10 transition-colors disabled:opacity-50"
                                                >
                                                    Logout All Other Devices
                                                </button>
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
