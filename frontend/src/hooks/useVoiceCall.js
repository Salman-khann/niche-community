import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const TURN_URLS = (import.meta.env.VITE_TURN_URL || '').split(',').map((u) => u.trim()).filter(Boolean);
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME || '';
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL || '';

const TURN_SERVERS = TURN_URLS.length > 0
    ? TURN_URLS.map((url) => ({
        urls: url,
        ...(TURN_USERNAME ? { username: TURN_USERNAME } : {}),
        ...(TURN_CREDENTIAL ? { credential: TURN_CREDENTIAL } : {}),
    }))
    : [];

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...TURN_SERVERS,
];
const AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
};

const buildDisplayCaptureOptions = ({ mode = 'screen', includeAudio = true } = {}) => {
    const normalizedMode = ['screen', 'window', 'tab'].includes(mode) ? mode : 'screen';
    const options = {
        video: true,
        audio: includeAudio,
    };

    if (normalizedMode === 'tab') {
        options.preferCurrentTab = true;
        options.surfaceSwitching = 'include';
        options.systemAudio = includeAudio ? 'include' : 'exclude';
        options.selfBrowserSurface = 'include';
    } else if (normalizedMode === 'window') {
        options.preferCurrentTab = false;
        options.surfaceSwitching = 'include';
        options.systemAudio = includeAudio ? 'include' : 'exclude';
        options.selfBrowserSurface = 'exclude';
    } else {
        options.preferCurrentTab = false;
        options.surfaceSwitching = 'include';
        options.systemAudio = includeAudio ? 'include' : 'exclude';
        options.selfBrowserSurface = 'exclude';
    }

    return options;
};

const buildLocalUser = (user, profile) => ({
    userId: user?._id || null,
    displayName: profile?.displayName || user?.name || 'Member',
    avatar: profile?.avatar || '',
});

const useVoiceCall = (socket, user, profile) => {
    const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [remoteMedia, setRemoteMedia] = useState([]);
    const [remoteVideos, setRemoteVideos] = useState([]);
    const [remoteScreenStreams, setRemoteScreenStreams] = useState([]);
    const [remoteCameraStreams, setRemoteCameraStreams] = useState([]);
    const [localScreenStream, setLocalScreenStream] = useState(null);
    const [localCameraStream, setLocalCameraStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [noiseReduction, setNoiseReduction] = useState(false);
    const [liveReactions, setLiveReactions] = useState([]);
    const [startTime, setStartTime] = useState(null);
    const [elapsed, setElapsed] = useState(0);

    const localStreamRef = useRef(null);
    const rawStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const activeChannelIdRef = useRef(null);
    const screenSharersRef = useRef(new Map());
    const peersRef = useRef(new Map()); // userId -> { pc, socketId, isPolite, makingOffer, ignoreOffer, pendingCandidates }
    const socketToUserRef = useRef(new Map());
    const pendingSignalsRef = useRef(new Map()); // socketId -> signal payloads waiting for user mapping
    const timersRef = useRef(null);
    const reactionTimersRef = useRef(new Set());
    const audioCtxRef = useRef(null);
    const handleSignalRef = useRef(null);
    const sendOfferRef = useRef(null);

    const ensureAudioConstraints = useCallback(async (stream) => {
        const track = stream?.getAudioTracks?.()[0];
        if (!track || typeof track.applyConstraints !== 'function') return;
        try {
            await track.applyConstraints(AUDIO_CONSTRAINTS);
        } catch {
            // ignore unsupported constraints
        }
    }, []);

    const playTone = useCallback((frequency, duration = 0.08, type = 'sine', gainValue = 0.04) => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            gain.gain.value = gainValue;
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            oscillator.stop(ctx.currentTime + duration);
        } catch {
            // ignore sound errors
        }
    }, []);

    const dedupeParticipants = useCallback((list) => {
        const map = new Map();
        (list || []).forEach((p) => {
            if (!p) return;
            const key = p.userId || p.socketId;
            if (!key) return;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, p);
                return;
            }
            map.set(key, {
                ...existing,
                ...p,
                socketId: p.socketId || existing.socketId,
                userId: p.userId || existing.userId,
                displayName: p.displayName || existing.displayName,
                avatar: p.avatar || existing.avatar,
            });
        });
        return Array.from(map.values());
    }, []);

    const buildProcessedStream = useCallback((rawStream) => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            const source = ctx.createMediaStreamSource(rawStream);
            const highpass = ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 80;
            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 12000;
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -28;
            compressor.knee.value = 24;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.25;
            const gain = ctx.createGain();
            gain.gain.value = 1.0;

            const destination = ctx.createMediaStreamDestination();
            source.connect(highpass);
            highpass.connect(lowpass);
            lowpass.connect(compressor);
            compressor.connect(gain);
            gain.connect(destination);

            return destination.stream;
        } catch {
            return rawStream;
        }
    }, []);

    const updateSocketMapping = useCallback((userId, socketId) => {
        if (!userId || !socketId) return;
        socketToUserRef.current.set(socketId, userId);
        if (pendingSignalsRef.current.has(socketId)) {
            const queued = pendingSignalsRef.current.get(socketId) || [];
            pendingSignalsRef.current.delete(socketId);
            queued.forEach((payload) => {
                handleSignalRef.current?.(payload);
            });
        }
    }, []);

    const addLocalTracks = useCallback((pc, peerState) => {
        const micTrack = localStreamRef.current?.getAudioTracks?.()[0];
        if (micTrack && !peerState.micSender) {
            peerState.micSender = pc.addTrack(micTrack, localStreamRef.current);
        }
        const cameraTrack = cameraStreamRef.current?.getVideoTracks?.()[0];
        if (cameraTrack && !peerState.cameraSender) {
            peerState.cameraSender = pc.addTrack(cameraTrack, cameraStreamRef.current);
        }
        const screenTrack = screenStreamRef.current?.getVideoTracks?.()[0];
        if (screenTrack && !peerState.screenSender) {
            peerState.screenSender = pc.addTrack(screenTrack, screenStreamRef.current);
        }
        const screenAudioTrack = screenStreamRef.current?.getAudioTracks?.()[0];
        if (screenAudioTrack && !peerState.screenAudioSender) {
            peerState.screenAudioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current);
        }
    }, []);

    const applyLocalAudioTrack = useCallback((stream) => {
        const track = stream?.getAudioTracks?.()[0];
        if (!track) return;
        peersRef.current.forEach((peer, userId) => {
            if (peer.micSender) {
                peer.micSender.replaceTrack(track);
            } else {
                peer.micSender = peer.pc.addTrack(track, stream);
                sendOfferRef.current?.(userId);
            }
        });
    }, []);

    const addCameraTrackToPeers = useCallback((track, stream) => {
        if (!track) return;
        peersRef.current.forEach((peer, userId) => {
            if (peer.cameraSender) {
                peer.cameraSender.replaceTrack(track);
            } else {
                peer.cameraSender = peer.pc.addTrack(track, stream);
            }
            sendOfferRef.current?.(userId);
        });
    }, []);

    const addScreenTracksToPeers = useCallback((stream) => {
        if (!stream) return;
        const videoTrack = stream.getVideoTracks?.()[0];
        const audioTrack = stream.getAudioTracks?.()[0];
        if (!videoTrack && !audioTrack) return;
        peersRef.current.forEach((peer, userId) => {
            if (videoTrack) {
                if (peer.screenSender) {
                    peer.screenSender.replaceTrack(videoTrack);
                } else {
                    peer.screenSender = peer.pc.addTrack(videoTrack, stream);
                }
            }
            if (audioTrack) {
                if (peer.screenAudioSender) {
                    peer.screenAudioSender.replaceTrack(audioTrack);
                } else {
                    peer.screenAudioSender = peer.pc.addTrack(audioTrack, stream);
                }
            }
            sendOfferRef.current?.(userId);
        });
    }, []);

    const removeCameraTrackFromPeers = useCallback(() => {
        peersRef.current.forEach((peer, userId) => {
            if (!peer.cameraSender) return;
            try {
                peer.pc.removeTrack(peer.cameraSender);
            } catch {
                // ignore
            }
            peer.cameraSender = null;
            sendOfferRef.current?.(userId);
        });
    }, []);

    const removeScreenTrackFromPeers = useCallback(() => {
        peersRef.current.forEach((peer, userId) => {
            let removed = false;
            if (peer.screenSender) {
                try {
                    peer.pc.removeTrack(peer.screenSender);
                } catch {
                    // ignore
                }
                peer.screenSender = null;
                removed = true;
            }
            if (peer.screenAudioSender) {
                try {
                    peer.pc.removeTrack(peer.screenAudioSender);
                } catch {
                    // ignore
                }
                peer.screenAudioSender = null;
                removed = true;
            }
            if (removed) {
                sendOfferRef.current?.(userId);
            }
        });
    }, []);

    const refreshLocalAudioStream = useCallback((enabled) => {
        if (!rawStreamRef.current) return;
        localStreamRef.current = enabled ? buildProcessedStream(rawStreamRef.current) : rawStreamRef.current;
        localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = !isMuted;
        });
        applyLocalAudioTrack(localStreamRef.current);
    }, [applyLocalAudioTrack, buildProcessedStream, isMuted]);

    const updateElapsed = useCallback(() => {
        if (!startTime) return;
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, [startTime]);

    useEffect(() => {
        if (!startTime) {
            setElapsed(0);
            if (timersRef.current) clearInterval(timersRef.current);
            timersRef.current = null;
            return;
        }
        updateElapsed();
        timersRef.current = setInterval(updateElapsed, 1000);
        return () => {
            if (timersRef.current) clearInterval(timersRef.current);
            timersRef.current = null;
        };
    }, [startTime, updateElapsed]);

    const attachRemoteStream = useCallback((socketId, stream) => {
        setRemoteMedia((prev) => {
            const filtered = prev.filter((item) => item.socketId !== socketId);
            return [...filtered, { socketId, stream }];
        });
    }, []);

    const removeRemoteStream = useCallback((socketId) => {
        setRemoteMedia((prev) => prev.filter((item) => item.socketId !== socketId));
        setRemoteVideos((prev) => prev.filter((item) => item.socketId !== socketId));
        setRemoteScreenStreams((prev) => prev.filter((item) => item.socketId !== socketId));
        setRemoteCameraStreams((prev) => prev.filter((item) => item.socketId !== socketId));
    }, []);

    const enqueueReaction = useCallback((reaction) => {
        if (!reaction?.emoji) return;
        const id = `${reaction.socketId || reaction.userId || 'reaction'}-${reaction.createdAt || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const item = { ...reaction, id };
        setLiveReactions((prev) => [...prev.slice(-7), item]);
        const timer = setTimeout(() => {
            setLiveReactions((prev) => prev.filter((entry) => entry.id !== id));
            reactionTimersRef.current.delete(timer);
        }, 4200);
        reactionTimersRef.current.add(timer);
    }, []);

    const sendOffer = useCallback(async (userId) => {
        const peer = peersRef.current.get(userId);
        if (!peer || !socket) return;
        const pc = peer.pc;
        if (pc.signalingState !== 'stable' || peer.makingOffer) return;
        try {
            peer.makingOffer = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('signal', { to: peer.socketId, data: { type: 'offer', sdp: pc.localDescription } });
        } catch {
            // ignore
        } finally {
            peer.makingOffer = false;
        }
    }, [socket]);

    useEffect(() => {
        sendOfferRef.current = sendOffer;
    }, [sendOffer]);

    const closePeerConnection = useCallback((userId) => {
        const peer = peersRef.current.get(userId);
        if (peer?.pc) {
            peer.pc.onicecandidate = null;
            peer.pc.ontrack = null;
            peer.pc.onconnectionstatechange = null;
            if (peer.disconnectTimer) {
                clearTimeout(peer.disconnectTimer);
                peer.disconnectTimer = null;
            }
            peer.pc.close();
        }
        if (peer?.socketId) {
            socketToUserRef.current.delete(peer.socketId);
            pendingSignalsRef.current.delete(peer.socketId);
            screenSharersRef.current.delete(peer.socketId);
            removeRemoteStream(peer.socketId);
        }
        peersRef.current.delete(userId);
    }, [removeRemoteStream]);

    const createPeerConnection = useCallback(
        (userId, socketId, isInitiator) => {
            if (!userId || !socketId) return null;
            if (userId === user?._id) return null;
            const existing = peersRef.current.get(userId);
            if (existing && existing.socketId === socketId) return existing.pc;
            if (existing && existing.socketId !== socketId) {
                closePeerConnection(userId);
            }

            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const peerState = {
                pc,
                socketId,
                isPolite: !isInitiator,
                makingOffer: false,
                ignoreOffer: false,
                pendingCandidates: [],
                micSender: null,
                cameraSender: null,
                screenSender: null,
                screenAudioSender: null,
                disconnectTimer: null,
            };
            peersRef.current.set(userId, peerState);
            updateSocketMapping(userId, socketId);

            addLocalTracks(pc, peerState);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket?.emit('signal', { to: socketId, data: { type: 'candidate', candidate: event.candidate } });
                }
            };

            pc.ontrack = (event) => {
                if (event.streams?.[0]) {
                    if (event.track.kind === 'video') {
                        const shareInfo = screenSharersRef.current.get(socketId);
                        const streamId = event.streams?.[0]?.id;
                        const isScreen = shareInfo === '*' || (shareInfo && streamId && shareInfo === streamId);
                        if (isScreen) {
                            setRemoteScreenStreams((prev) => {
                                const filtered = prev.filter((item) => item.socketId !== socketId);
                                return [...filtered, { socketId, stream: event.streams[0] }];
                            });
                            setRemoteVideos((prev) => {
                                const filtered = prev.filter((item) => item.socketId !== socketId);
                                return [...filtered, { socketId, stream: event.streams[0] }];
                            });
                        } else {
                            setRemoteCameraStreams((prev) => {
                                const filtered = prev.filter((item) => item.socketId !== socketId);
                                return [...filtered, { socketId, stream: event.streams[0] }];
                            });
                        }
                        event.track.onended = () => {
                            setRemoteVideos((prev) => prev.filter((item) => item.socketId !== socketId));
                            setRemoteScreenStreams((prev) => prev.filter((item) => item.socketId !== socketId));
                            setRemoteCameraStreams((prev) => prev.filter((item) => item.socketId !== socketId));
                        };
                    } else {
                        attachRemoteStream(socketId, event.streams[0]);
                    }
                }
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
                    if (peerState.disconnectTimer) {
                        clearTimeout(peerState.disconnectTimer);
                        peerState.disconnectTimer = null;
                    }
                    return;
                }
                if (pc.connectionState === 'failed') {
                    if (typeof pc.restartIce === 'function') {
                        try {
                            pc.restartIce();
                            sendOffer(userId);
                            return;
                        } catch {
                            // fall through to close
                        }
                    }
                    closePeerConnection(userId);
                    return;
                }
                if (pc.connectionState === 'disconnected') {
                    if (peerState.disconnectTimer) return;
                    peerState.disconnectTimer = setTimeout(() => {
                        if (pc.connectionState === 'disconnected') {
                            closePeerConnection(userId);
                        }
                    }, 8000);
                }
            };

            if (isInitiator) {
                sendOffer(userId);
            }

            return pc;
        },
        [socket, user?._id, addLocalTracks, attachRemoteStream, closePeerConnection, updateSocketMapping, sendOffer]
    );

    const joinVoice = useCallback(
        async (channel) => {
            if (!socket || !channel?._id) return;
            if (activeVoiceChannel?._id === channel._id) return;
            if (activeVoiceChannel?._id && activeVoiceChannel._id !== channel._id) {
                socket.emit('voice:leave');
                socket.emit('leave-room', { roomId: activeVoiceChannel._id });
                peersRef.current.forEach((_, key) => closePeerConnection(key));
                peersRef.current.clear();
                socketToUserRef.current.clear();
                pendingSignalsRef.current.clear();
                screenSharersRef.current.clear();
                if (rawStreamRef.current) {
                    rawStreamRef.current.getTracks().forEach((track) => track.stop());
                    rawStreamRef.current = null;
                }
                localStreamRef.current = null;
                if (screenStreamRef.current) {
                    screenStreamRef.current.getTracks().forEach((track) => track.stop());
                    screenStreamRef.current = null;
                }
                setLocalScreenStream(null);
                if (cameraStreamRef.current) {
                    cameraStreamRef.current.getTracks().forEach((track) => track.stop());
                    cameraStreamRef.current = null;
                }
                setLocalCameraStream(null);
                setIsSharing(false);
                setIsCameraOn(false);
                setParticipants([]);
                setRemoteMedia([]);
                setRemoteVideos([]);
                setRemoteScreenStreams([]);
                setRemoteCameraStreams([]);
                setLiveReactions([]);
            }

            try {
                if (!localStreamRef.current) {
                    rawStreamRef.current = await navigator.mediaDevices.getUserMedia({
                        audio: AUDIO_CONSTRAINTS,
                        video: false,
                    });
                    await ensureAudioConstraints(rawStreamRef.current);
                    localStreamRef.current = noiseReduction ? buildProcessedStream(rawStreamRef.current) : rawStreamRef.current;
                } else {
                    await ensureAudioConstraints(rawStreamRef.current);
                }
            } catch (err) {
                console.error('Voice call: failed to access microphone', err);
                return;
            }

            localStreamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = !isMuted;
            });
            applyLocalAudioTrack(localStreamRef.current);
            if (cameraStreamRef.current?.getVideoTracks?.()[0]) {
                addCameraTrackToPeers(cameraStreamRef.current.getVideoTracks()[0], cameraStreamRef.current);
            }
            if (screenStreamRef.current?.getVideoTracks?.()[0]) {
                addScreenTracksToPeers(screenStreamRef.current);
            }

            activeChannelIdRef.current = channel._id;
            setActiveVoiceChannel(channel);
            setStartTime(Date.now());
            const localUser = buildLocalUser(user, profile);
            setParticipants([{ socketId: 'local', ...localUser, isLocal: true, isMuted }]);
            socket.emit('voice:join', { channelId: channel._id, communityId: channel.communityId, user: localUser });
            socket.emit('join-room', { roomId: channel._id, user: localUser });
            if (isMuted) {
                socket.emit('voice:mute', { channelId: channel._id, isMuted: true });
            }
            playTone(760, 0.09, 'sine', 0.04);
        },
        [socket, user, profile, activeVoiceChannel, isMuted, playTone, buildProcessedStream, noiseReduction, ensureAudioConstraints, closePeerConnection, applyLocalAudioTrack, addCameraTrackToPeers, addScreenTracksToPeers]
    );

    const leaveVoice = useCallback(() => {
        if (socket) {
            socket.emit('voice:leave');
            if (activeVoiceChannel?._id) {
                socket.emit('leave-room', { roomId: activeVoiceChannel._id });
            }
        }
        activeChannelIdRef.current = null;
        peersRef.current.forEach((_, key) => closePeerConnection(key));
        peersRef.current.clear();
        socketToUserRef.current.clear();
        pendingSignalsRef.current.clear();
        screenSharersRef.current.clear();
        if (rawStreamRef.current) {
            rawStreamRef.current.getTracks().forEach((track) => track.stop());
            rawStreamRef.current = null;
        }
        localStreamRef.current = null;
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => track.stop());
            screenStreamRef.current = null;
        }
        setLocalScreenStream(null);
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach((track) => track.stop());
            cameraStreamRef.current = null;
        }
        setLocalCameraStream(null);
        setIsCameraOn(false);
        setParticipants([]);
        setRemoteMedia([]);
        setRemoteVideos([]);
        setRemoteScreenStreams([]);
        setRemoteCameraStreams([]);
        setLiveReactions([]);
        setActiveVoiceChannel(null);
        setStartTime(null);
        setIsSharing(false);
        playTone(240, 0.12, 'sine', 0.05);
    }, [socket, closePeerConnection, activeVoiceChannel?._id]);

    const sendReaction = useCallback((emoji) => {
        if (!emoji) return;
        const channelId = activeVoiceChannel?._id || activeChannelIdRef.current;
        if (!channelId) return;
        const localIdentity = buildLocalUser(user, profile);
        const payload = {
            channelId,
            emoji,
            user: localIdentity,
        };
        if (socket) {
            socket.emit('voice:reaction', payload);
        }
        enqueueReaction({
            channelId,
            socketId: socket?.id || 'local',
            userId: localIdentity.userId,
            displayName: localIdentity.displayName || 'You',
            avatar: localIdentity.avatar || '',
            emoji,
            createdAt: Date.now(),
            isLocal: true,
        });
    }, [socket, activeVoiceChannel?._id, user, profile, enqueueReaction]);

    const stopScreenShare = useCallback(() => {
        if (!screenStreamRef.current) return;
        const streamId = screenStreamRef.current.id;
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setLocalScreenStream(null);
        setIsSharing(false);
        if (activeVoiceChannel?._id) {
            socket?.emit('voice:share-stop', { channelId: activeVoiceChannel._id, streamId });
        }
        removeScreenTrackFromPeers();
    }, [socket, activeVoiceChannel?._id, removeScreenTrackFromPeers]);

    const stopCamera = useCallback(() => {
        if (!cameraStreamRef.current) return;
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        setLocalCameraStream(null);
        setIsCameraOn(false);
        if (activeVoiceChannel?._id) {
            socket?.emit('voice:camera-stop', { channelId: activeVoiceChannel._id });
        }
        removeCameraTrackFromPeers();
    }, [removeCameraTrackFromPeers, socket, activeVoiceChannel?._id]);

    const startCamera = useCallback(async () => {
        if (!activeVoiceChannel || !socket) return;
        if (cameraStreamRef.current) return;
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            const [track] = camStream.getVideoTracks();
            if (!track) return;
            cameraStreamRef.current = camStream;
            setLocalCameraStream(camStream);
            setIsCameraOn(true);
            socket.emit('voice:camera-start', { channelId: activeVoiceChannel._id });
            addCameraTrackToPeers(track, camStream);
            track.onended = () => {
                stopCamera();
            };
        } catch (err) {
            console.error('Camera access failed', err);
        }
    }, [activeVoiceChannel, socket, addCameraTrackToPeers, stopCamera]);

    const startScreenShare = useCallback(async (options = {}) => {
        if (!activeVoiceChannel || !socket) return;
        if (screenStreamRef.current) return;
        const includeAudio = options.includeAudio !== false;
        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                console.error('Screen share not supported in this browser');
                return;
            }
            if (!localStreamRef.current) {
                try {
                    rawStreamRef.current = await navigator.mediaDevices.getUserMedia({
                        audio: AUDIO_CONSTRAINTS,
                        video: false,
                    });
                    await ensureAudioConstraints(rawStreamRef.current);
                    localStreamRef.current = noiseReduction ? buildProcessedStream(rawStreamRef.current) : rawStreamRef.current;
                } catch {
                    // allow screen share even if mic access is denied
                }
            }
            const captureOptions = buildDisplayCaptureOptions({
                mode: options.mode || 'screen',
                includeAudio,
            });
            const screenStream = await navigator.mediaDevices.getDisplayMedia(captureOptions);
            const [track] = screenStream.getVideoTracks();
            if (!track) return;
            screenStreamRef.current = screenStream;
            setLocalScreenStream(screenStream);
            setIsSharing(true);
            socket.emit('voice:share-start', { channelId: activeVoiceChannel._id, streamId: screenStream.id });
            addScreenTracksToPeers(screenStream);

            track.onended = () => {
                stopScreenShare();
            };
        } catch (err) {
            console.error('Screen share failed', err);
            setIsSharing(false);
        }
    }, [activeVoiceChannel, socket, stopScreenShare, buildProcessedStream, noiseReduction, ensureAudioConstraints, addScreenTracksToPeers]);

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((track) => {
                    track.enabled = !next;
                });
            }
            const channelId = activeVoiceChannel?._id;
            if (socket && channelId) {
                socket.emit('voice:mute', { channelId, isMuted: next });
            }
            setParticipants((prevParticipants) => prevParticipants.map((p) => (
                p.socketId === 'local' || (socket?.id && p.socketId === socket.id)
                    ? { ...p, isMuted: next }
                    : p
            )));
            playTone(next ? 420 : 620, 0.06, 'triangle', 0.035);
            return next;
        });
    }, [playTone, socket, activeVoiceChannel?._id]);

    const toggleDeafen = useCallback(() => {
        setIsDeafened((prev) => {
            const next = !prev;
            playTone(next ? 360 : 520, 0.06, 'triangle', 0.03);
            return next;
        });
    }, [playTone]);

    const toggleNoiseReduction = useCallback(() => {
        setNoiseReduction((prev) => {
            const next = !prev;
            refreshLocalAudioStream(next);
            return next;
        });
    }, [refreshLocalAudioStream]);

    const connectedPeerIds = useMemo(() => {
        const ids = new Set();
        remoteMedia.forEach((item) => ids.add(item.socketId));
        remoteVideos.forEach((item) => ids.add(item.socketId));
        remoteScreenStreams.forEach((item) => ids.add(item.socketId));
        remoteCameraStreams.forEach((item) => ids.add(item.socketId));
        return Array.from(ids);
    }, [remoteMedia, remoteVideos, remoteScreenStreams, remoteCameraStreams]);

    useEffect(() => {
        if (!socket) return;

        const handleRoomUsers = ({ roomId, users }) => {
            const activeId = activeChannelIdRef.current || activeVoiceChannel?._id;
            if (!activeId) return;
            const roomKey = roomId?.toString?.() || String(roomId || '');
            const activeKey = activeId?.toString?.() || String(activeId);
            if (roomKey !== activeKey) return;
            const list = Array.isArray(users) ? users : [];
            const localUser = buildLocalUser(user, profile);
            const localSocketId = socket?.id;

            list.forEach((entry) => updateSocketMapping(entry.userId, entry.socketId));

            setParticipants((prev) => {
                const merged = [];
                const existingMap = new Map();
                prev.forEach((p) => {
                    const key = p.userId || p.socketId;
                    if (!existingMap.has(key)) existingMap.set(key, p);
                });
                list.forEach((entry) => {
                    const key = entry.userId || entry.socketId;
                    const existing = existingMap.get(key);
                    merged.push({
                        socketId: entry.socketId,
                        userId: entry.userId,
                        displayName: entry.displayName || existing?.displayName || 'Member',
                        avatar: entry.avatar || existing?.avatar || '',
                        isMuted: existing?.isMuted || false,
                        isLocal: localSocketId ? entry.socketId === localSocketId : false,
                    });
                });
                if (localSocketId && !merged.some((p) => p.socketId === localSocketId)) {
                    merged.unshift({ socketId: localSocketId, ...localUser, isLocal: true, isMuted });
                }
                return dedupeParticipants(merged);
            });

            list.forEach((entry) => {
                if (!entry?.userId || entry.userId === user?._id) return;
                createPeerConnection(entry.userId, entry.socketId, false);
            });
        };

        const handleUserJoined = (payload) => {
            if (!payload?.userId || !payload?.socketId) return;
            const activeId = activeChannelIdRef.current || activeVoiceChannel?._id;
            if (!activeId) return;
            const roomKey = payload.roomId?.toString?.() || String(payload.roomId || '');
            const activeKey = activeId?.toString?.() || String(activeId);
            if (roomKey !== activeKey) return;
            updateSocketMapping(payload.userId, payload.socketId);
            setParticipants((prev) => {
                const exists = prev.find((p) => (p.userId && p.userId === payload.userId) || p.socketId === payload.socketId);
                if (exists) {
                    return dedupeParticipants(prev.map((p) => (
                        (p.userId && p.userId === payload.userId)
                            ? { ...p, socketId: payload.socketId, displayName: payload.displayName || p.displayName, avatar: payload.avatar || p.avatar }
                            : p
                    )));
                }
                return dedupeParticipants([...prev, {
                    socketId: payload.socketId,
                    userId: payload.userId,
                    displayName: payload.displayName || 'Member',
                    avatar: payload.avatar || '',
                    isMuted: false,
                    isLocal: false,
                }]);
            });
            createPeerConnection(payload.userId, payload.socketId, true);
        };

        const handleUserLeft = ({ roomId, userId, socketId }) => {
            const activeId = activeChannelIdRef.current || activeVoiceChannel?._id;
            if (!activeId) return;
            const roomKey = roomId?.toString?.() || String(roomId || '');
            const activeKey = activeId?.toString?.() || String(activeId);
            if (roomKey !== activeKey) return;
            const resolvedUserId = userId || socketToUserRef.current.get(socketId);
            if (resolvedUserId) closePeerConnection(resolvedUserId);
            if (socketId) screenSharersRef.current.delete(socketId);
            setParticipants((prev) => prev.filter((p) => {
                if (resolvedUserId && p.userId && p.userId === resolvedUserId) return false;
                if (socketId && p.socketId === socketId) return false;
                return true;
            }));
        };

        const handleSignal = async ({ from, fromUserId, data }) => {
            const socketId = from;
            const resolvedUserId = fromUserId || socketToUserRef.current.get(socketId);
            if (!socketId || !data) return;
            if (!resolvedUserId) {
                const queued = pendingSignalsRef.current.get(socketId) || [];
                queued.push({ from: socketId, fromUserId, data });
                pendingSignalsRef.current.set(socketId, queued);
                return;
            }
            updateSocketMapping(resolvedUserId, socketId);
            let peer = peersRef.current.get(resolvedUserId);
            if (!peer) {
                createPeerConnection(resolvedUserId, socketId, false);
                peer = peersRef.current.get(resolvedUserId);
            }
            if (!peer) return;
            const pc = peer.pc;
            const offerCollision = data.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
            peer.ignoreOffer = !peer.isPolite && offerCollision;
            if (peer.ignoreOffer) return;

            try {
                if (data.type === 'offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { to: socketId, data: { type: 'answer', sdp: pc.localDescription } });
                } else if (data.type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                } else if (data.type === 'candidate' && data.candidate) {
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } else {
                        peer.pendingCandidates.push(data.candidate);
                    }
                }

                if (pc.remoteDescription && peer.pendingCandidates.length > 0) {
                    const pending = [...peer.pendingCandidates];
                    peer.pendingCandidates = [];
                    for (const candidate of pending) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                }
            } catch {
                // ignore
            }
        };

        const handleShareStarted = ({ socketId, streamId }) => {
            if (!socketId) return;
            screenSharersRef.current.set(socketId, streamId || '*');
            if (!streamId) return;
            setRemoteCameraStreams((prev) => {
                const existing = prev.find((item) => item.socketId === socketId && item.stream?.id === streamId);
                if (!existing) return prev;
                setRemoteScreenStreams((screenPrev) => {
                    const filtered = screenPrev.filter((item) => item.socketId !== socketId);
                    return [...filtered, existing];
                });
                setRemoteVideos((videoPrev) => {
                    const filtered = videoPrev.filter((item) => item.socketId !== socketId);
                    return [...filtered, existing];
                });
                return prev.filter((item) => !(item.socketId === socketId && item.stream?.id === streamId));
            });
        };

        const handleShareStopped = ({ socketId }) => {
            if (!socketId) return;
            screenSharersRef.current.delete(socketId);
            setRemoteVideos((prev) => prev.filter((item) => item.socketId !== socketId));
            setRemoteScreenStreams((prev) => prev.filter((item) => item.socketId !== socketId));
        };

        const handleCameraStopped = ({ socketId }) => {
            if (!socketId) return;
            setRemoteCameraStreams((prev) => prev.filter((item) => item.socketId !== socketId));
        };

        const handleMembers = ({ channelId, members }) => {
            if (!Array.isArray(members)) return;
            const activeId = activeChannelIdRef.current || activeVoiceChannel?._id;
            if (!activeId) return;
            const channelKey = channelId?.toString?.() || String(channelId);
            const activeKey = activeId?.toString?.() || String(activeId);
            if (channelKey !== activeKey) return;
            const localUser = buildLocalUser(user, profile);
            const localId = socket?.id;
            members.forEach((m) => {
                updateSocketMapping(m.userId, m.socketId);
                if (m?.screenStreamId && m.socketId) {
                    handleShareStarted({ socketId: m.socketId, streamId: m.screenStreamId });
                } else if (m?.socketId) {
                    screenSharersRef.current.delete(m.socketId);
                }
            });
            setParticipants((prev) => {
                const existingMap = new Map();
                prev.forEach((p) => {
                    const key = p.userId || p.socketId;
                    if (!existingMap.has(key)) existingMap.set(key, p);
                });
                const merged = members.map((m) => {
                    const key = m.userId || m.socketId;
                    const existing = existingMap.get(key);
                    return {
                        socketId: m.socketId || existing?.socketId,
                        userId: m.userId || existing?.userId,
                        displayName: m.displayName || existing?.displayName || 'Member',
                        avatar: m.avatar || existing?.avatar || '',
                        isMuted: !!m.isMuted,
                        isLocal: localId ? m.socketId === localId : existing?.isLocal || false,
                    };
                });
                if (localId && !merged.some((p) => p.socketId === localId)) {
                    merged.unshift({ socketId: localId, ...localUser, isLocal: true, isMuted });
                }
                return dedupeParticipants(merged);
            });
        };

        const handleVoiceReaction = (payload) => {
            const activeId = activeChannelIdRef.current || activeVoiceChannel?._id;
            if (!activeId) return;
            const channelKey = payload?.channelId?.toString?.() || String(payload?.channelId || '');
            const activeKey = activeId?.toString?.() || String(activeId);
            if (!channelKey || channelKey !== activeKey) return;
            if (payload?.socketId && socket?.id && payload.socketId === socket.id) return;
            enqueueReaction(payload);
        };

        handleSignalRef.current = handleSignal;

        socket.on('room-users', handleRoomUsers);
        socket.on('user-joined', handleUserJoined);
        socket.on('user-left', handleUserLeft);
        socket.on('signal', handleSignal);
        socket.on('voice:signal', handleSignal);
        socket.on('voice:members', handleMembers);
        socket.on('voice:share-started', handleShareStarted);
        socket.on('voice:share-stopped', handleShareStopped);
        socket.on('voice:camera-stopped', handleCameraStopped);
        socket.on('voice:reaction', handleVoiceReaction);

        return () => {
            socket.off('room-users', handleRoomUsers);
            socket.off('user-joined', handleUserJoined);
            socket.off('user-left', handleUserLeft);
            socket.off('signal', handleSignal);
            socket.off('voice:signal', handleSignal);
            socket.off('voice:members', handleMembers);
            socket.off('voice:share-started', handleShareStarted);
            socket.off('voice:share-stopped', handleShareStopped);
            socket.off('voice:camera-stopped', handleCameraStopped);
            socket.off('voice:reaction', handleVoiceReaction);
        };
    }, [socket, user, profile, createPeerConnection, closePeerConnection, dedupeParticipants, activeVoiceChannel?._id, enqueueReaction]);

    useEffect(() => {
        return () => {
            peersRef.current.forEach((_, key) => closePeerConnection(key));
            peersRef.current.clear();
            screenSharersRef.current.clear();
            if (rawStreamRef.current) {
                rawStreamRef.current.getTracks().forEach((track) => track.stop());
                rawStreamRef.current = null;
            }
            localStreamRef.current = null;
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((track) => track.stop());
                screenStreamRef.current = null;
            }
            setLocalScreenStream(null);
            if (cameraStreamRef.current) {
                cameraStreamRef.current.getTracks().forEach((track) => track.stop());
                cameraStreamRef.current = null;
            }
            setLocalCameraStream(null);
            setIsCameraOn(false);
            reactionTimersRef.current.forEach((timer) => clearTimeout(timer));
            reactionTimersRef.current.clear();
        };
    }, [closePeerConnection]);

    return {
        activeVoiceChannel,
        participants,
        remoteMedia,
        remoteVideos,
        remoteScreenStreams,
        remoteCameraStreams,
        localScreenStream,
        localCameraStream,
        isMuted,
        isDeafened,
        isSharing,
        isCameraOn,
        noiseReduction,
        liveReactions,
        connectedPeerIds,
        elapsed,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        toggleNoiseReduction,
        startCamera,
        stopCamera,
        startScreenShare,
        stopScreenShare,
        sendReaction,
    };
};

export default useVoiceCall;
