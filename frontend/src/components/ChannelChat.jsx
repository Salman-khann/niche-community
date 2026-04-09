import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Plus, Send, Smile, Image as ImageIcon, X, Heart, MessageCircle, Pin, Flag, FileText, MoreHorizontal, Reply, Forward, Copy, Link2, ChevronRight, Volume2, Bell } from 'lucide-react';
import { useChannelMessageStore } from '../stores/channelMessageStore';
import { useFeedStore } from '../stores/feedStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useChannelStore } from '../stores/channelStore';
import { apiUrl } from '../config/urls';
import EmojiPicker from './EmojiPicker';
import PinnedMessagesModal from './PinnedMessagesModal';
import ChannelEditModal from './ChannelEditModal';
import AttachmentPreviewCard from './AttachmentPreviewCard';
import EmojiArt from './EmojiArt';
import { CHAT_REACTION_EMOJIS, normalizeEmojiShortcodes } from '../utils/emojiShortcodes';

const isImageUrl = (url) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(url) || url.includes('image/upload');
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOC_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx']);

const formatBytes = (bytes = 0) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (date) => {
    try {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
};

const ChannelChat = ({ channel, socket, currentUser, members = [], showPins, onClosePins, canEditChannel = false, editSignal = 0 }) => {
    const {
        messages,
        isLoading,
        isLoadingOlder,
        error,
        fetchMessages,
        loadOlderMessages,
        clearChannelState,
        sendMessage,
        pushMessage,
        toggleReaction,
        handleReaction,
        commentsByMessage,
        commentsLoading,
        commentsPaging,
        fetchComments,
        loadOlderComments,
        addComment,
        reactToComment,
        handleComment,
        handleCommentReaction: applyCommentReactionFromSocket,
        fetchPinned,
        pinnedMessages,
        togglePin,
        handlePin,
        scrollToMessageId,
        setScrollTarget,
        hasMoreMessages,
    } = useChannelMessageStore();
    const { updateChannelName, deleteChannel } = useChannelStore();
    const { uploadFile } = useFeedStore();
    const { activeCommunityId } = useWorkspaceStore();
    const [text, setText] = useState('');
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [openComments, setOpenComments] = useState({});
    const [commentDrafts, setCommentDrafts] = useState({});
    const [showEmoji, setShowEmoji] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
    const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    const [pinsLoading, setPinsLoading] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportTarget, setReportTarget] = useState(null);
    const [reportReason, setReportReason] = useState('Spam');
    const [reportDetails, setReportDetails] = useState('');
    const [reportError, setReportError] = useState('');
    const [isReporting, setIsReporting] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editError, setEditError] = useState('');
    const [sendError, setSendError] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const typingTimeoutRef = useRef(null);
    const inputRef = useRef(null);
    const endRef = useRef(null);
    const messageMenuRef = useRef(null);
    const commentInputRefs = useRef({});
    const scrollContainerRef = useRef(null);
    const sendLockRef = useRef(false);
    const COMMENT_REACTIONS = CHAT_REACTION_EMOJIS;

    const handleCloseEdit = () => {
        setShowEditModal(false);
        setEditError('');
        setIsSavingEdit(false);
        setIsDeleting(false);
    };

    const memberMap = useMemo(() => {
        const map = new Map();
        const all = [
            ...(currentUser?.id ? [{
                _id: currentUser.id,
                displayName: currentUser.displayName,
                username: currentUser.username,
                avatar: currentUser.avatar,
            }] : []),
            ...members,
        ];
        all.forEach((m) => {
            if (!m?._id) return;
            map.set(m._id, m);
        });
        return map;
    }, [currentUser, members]);

    const mentionCandidates = useMemo(() => {
        const list = [];
        memberMap.forEach((m) => {
            if (m._id === currentUser?.id) return;
            list.push({
                ...m,
                username: m.username || (m.displayName || '').toLowerCase().replace(/\s+/g, ''),
            });
        });
        return list;
    }, [memberMap, currentUser?.id]);

    const filteredMentions = useMemo(() => {
        if (!mentionQuery) return mentionCandidates.slice(0, 6);
        const q = mentionQuery.toLowerCase();
        return mentionCandidates.filter((m) => {
            const name = (m.displayName || '').toLowerCase();
            const username = (m.username || '').toLowerCase();
            return name.includes(q) || username.includes(q);
        }).slice(0, 6);
    }, [mentionCandidates, mentionQuery]);

    useEffect(() => {
        if (!channel?._id) return;
        let active = true;
        const run = async () => {
            setIsSwitching(true);
            clearChannelState?.();
            try {
                await fetchMessages(channel._id);
            } catch { }
            if (active) setIsSwitching(false);
            socket?.emit('join_channel', channel._id);
        };
        run();
        return () => { active = false; };
    }, [channel?._id, fetchMessages, socket, clearChannelState]);

    useEffect(() => {
        if (channel?._id) return;
        clearChannelState?.();
        setIsSwitching(false);
    }, [channel?._id, clearChannelState]);

    useEffect(() => {
        if (!editSignal) return;
        if (!canEditChannel) return;
        if (!channel?._id) return;
        setShowEditModal(true);
    }, [editSignal, canEditChannel, channel?._id]);

    useEffect(() => {
        setShowEditModal(false);
        setEditError('');
        setIsSavingEdit(false);
        setIsDeleting(false);
    }, [activeCommunityId, channel?._id]);

    useEffect(() => {
        if (!socket) return;
        const handleMessage = (msg) => {
            if (!msg?.channelId || msg.channelId !== channel?._id) return;
            pushMessage(msg);
        };
        const handleReactionSocket = (payload) => {
            if (!payload?.messageId) return;
            handleReaction(payload);
        };
        const handleCommentSocket = (payload) => {
            if (!payload?.messageId) return;
            handleComment(payload);
        };
        const handleTyping = ({ channelId, userId, isTyping }) => {
            if (!channelId || channelId !== channel?._id || userId === currentUser?.id) return;
            setTypingUsers((prev) => {
                const next = new Set(prev);
                if (isTyping) next.add(userId);
                else next.delete(userId);
                return Array.from(next);
            });
        };
        const handlePinSocket = (payload) => {
            if (!payload?.messageId) return;
            handlePin(payload);
        };
        const handleCommentReactionSocket = (payload) => {
            if (!payload?.messageId || !payload?.commentId) return;
            applyCommentReactionFromSocket(payload);
        };
        socket.on('channel:message', handleMessage);
        socket.on('channel:reaction', handleReactionSocket);
        socket.on('channel:comment', handleCommentSocket);
        socket.on('channel:pin', handlePinSocket);
        socket.on('channel:comment-reaction', handleCommentReactionSocket);
        socket.on('channel:typing', handleTyping);
        return () => {
            socket.off('channel:message', handleMessage);
            socket.off('channel:reaction', handleReactionSocket);
            socket.off('channel:comment', handleCommentSocket);
            socket.off('channel:pin', handlePinSocket);
            socket.off('channel:comment-reaction', handleCommentReactionSocket);
            socket.off('channel:typing', handleTyping);
        };
    }, [socket, channel?._id, pushMessage, currentUser?.id, handleReaction, handleComment, handlePin, applyCommentReactionFromSocket]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages]);

    useEffect(() => {
        if (!openMessageMenuId) return;
        const onOutside = (e) => {
            if (messageMenuRef.current && !messageMenuRef.current.contains(e.target)) {
                setOpenMessageMenuId(null);
                setReactionPickerMessageId(null);
            }
        };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, [openMessageMenuId]);

    const emitTyping = () => {
        if (!channel?._id || !socket) return;
        socket.emit('channel:typing', { channelId: channel._id, userId: currentUser?.id, isTyping: true });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('channel:typing', { channelId: channel._id, userId: currentUser?.id, isTyping: false });
        }, 1200);
    };

    const handleTextChange = (value) => {
        setText(value);
        emitTyping();
        const cursor = inputRef.current?.selectionStart ?? value.length;
        const slice = value.slice(0, cursor);
        const atIndex = slice.lastIndexOf('@');
        if (atIndex === -1) {
            setShowMentions(false);
            setMentionQuery('');
            return;
        }
        const before = slice[atIndex - 1];
        if (before && !/\s/.test(before)) {
            setShowMentions(false);
            setMentionQuery('');
            return;
        }
        const query = slice.slice(atIndex + 1);
        if (/\s/.test(query)) {
            setShowMentions(false);
            setMentionQuery('');
            return;
        }
        setShowMentions(true);
        setMentionQuery(query);
    };

    const insertMention = (member) => {
        if (!inputRef.current) return;
        const username = member.username || (member.displayName || '').toLowerCase().replace(/\s+/g, '');
        const cursor = inputRef.current.selectionStart ?? text.length;
        const before = text.slice(0, cursor);
        const after = text.slice(cursor);
        const atIndex = before.lastIndexOf('@');
        if (atIndex === -1) return;
        const nextText = `${before.slice(0, atIndex)}@${username} ${after}`;
        setText(nextText);
        setShowMentions(false);
        setMentionQuery('');
        requestAnimationFrame(() => {
            const nextPos = atIndex + username.length + 2;
            inputRef.current?.setSelectionRange(nextPos, nextPos);
        });
    };

    const handleEmoji = (emoji) => {
        setText((prev) => `${prev}${emoji}`);
        setShowEmoji(false);
        emitTyping();
    };

    const handleFiles = (fileList) => {
        const incoming = Array.from(fileList || []);
        const valid = [];
        let rejectionMessage = '';

        incoming.forEach((file) => {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            const isImage = file.type.startsWith('image/');
            const isSupportedDoc = ALLOWED_DOC_EXTENSIONS.has(ext);
            if (!isImage && !isSupportedDoc) {
                rejectionMessage = 'Unsupported file type. Use images, PDF, DOC/DOCX, TXT, CSV, XLS/XLSX, or PPT/PPTX.';
                return;
            }
            if (file.size > MAX_UPLOAD_BYTES) {
                rejectionMessage = 'File is too large. Maximum size is 10 MB per file.';
                return;
            }
            valid.push(file);
        });

        if (rejectionMessage) {
            setSendError(rejectionMessage);
        } else {
            setSendError('');
        }

        const next = valid.map((file) => ({
            file,
            id: `${file.name}-${file.size}-${file.lastModified}`,
            isImage: file.type.startsWith('image/'),
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        }));
        setFiles((prev) => [...prev, ...next]);
    };

    const removeFile = (id) => {
        setFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (file?.preview) URL.revokeObjectURL(file.preview);
            return prev.filter((f) => f.id !== id);
        });
        setSendError('');
    };

    const handleSend = async () => {
        if (sendLockRef.current || isUploading) return;
        if (!channel?._id) return;
        const normalizedText = normalizeEmojiShortcodes(text);
        const trimmed = normalizedText.trim();
        if (!trimmed && files.length === 0) return;
        sendLockRef.current = true;
        setIsUploading(true);
        setSendError('');
        try {
            const mediaURLs = [];
            for (const f of files) {
                const url = await uploadFile(f.file);
                mediaURLs.push(url);
            }
            const mentionIds = [];
            const tokens = trimmed.match(/@([\w.-]+)/g) || [];
            tokens.forEach((token) => {
                const handle = token.slice(1).toLowerCase();
                const match = mentionCandidates.find((m) => (m.username || '').toLowerCase() === handle);
                if (match && !mentionIds.includes(match._id)) mentionIds.push(match._id);
            });
            const payload = { content: trimmed, mediaURLs, mentions: mentionIds };
            const msg = await sendMessage(channel._id, payload);
            pushMessage(msg);
            setText('');
            files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
            setFiles([]);
            socket?.emit('channel:typing', { channelId: channel._id, userId: currentUser?.id, isTyping: false });
        } catch (err) {
            setSendError(err?.message || 'Failed to send message with attachment.');
        } finally {
            setIsUploading(false);
            sendLockRef.current = false;
        }
    };

    const handleToggleComment = async (messageId) => {
        setOpenComments((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
        const hasComments = commentsByMessage[messageId];
        if (!hasComments) {
            await fetchComments(channel._id, messageId, { limit: 50 });
        }
    };

    const handleCommentSend = async (messageId) => {
        const textValue = normalizeEmojiShortcodes(commentDrafts[messageId] || '').trim();
        if (!textValue) return;
        const mentionIds = [];
        const tokens = textValue.match(/@([\w.-]+)/g) || [];
        tokens.forEach((token) => {
            const handle = token.slice(1).toLowerCase();
            const match = mentionCandidates.find((m) => (m.username || '').toLowerCase() === handle);
            if (match && !mentionIds.includes(match._id)) mentionIds.push(match._id);
        });
        await addComment(channel._id, messageId, textValue, mentionIds);
        setCommentDrafts((prev) => ({ ...prev, [messageId]: '' }));
    };

    const handleReplyToMessage = async (messageId) => {
        setOpenComments((prev) => ({ ...prev, [messageId]: true }));
        const hasComments = commentsByMessage[messageId];
        if (!hasComments) {
            await fetchComments(channel._id, messageId, { limit: 50 });
        }
        requestAnimationFrame(() => {
            commentInputRefs.current[messageId]?.focus?.();
        });
        setOpenMessageMenuId(null);
    };

    const handleLoadOlderComments = async (messageId) => {
        try {
            await loadOlderComments(channel._id, messageId, 50);
        } catch {
            // no-op
        }
    };

    const handleForwardMessage = (message, sender) => {
        const senderName = sender?.displayName || 'Member';
        const next = `Fwd from ${senderName}: ${message?.content || ''}`.trim();
        setText((prev) => (prev ? `${prev}\n${next}` : next));
        requestAnimationFrame(() => inputRef.current?.focus?.());
        setOpenMessageMenuId(null);
    };

    const copyMessageText = async (messageId, content) => {
        if (!content) return;
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId((prev) => (prev === messageId ? null : prev)), 1200);
            setOpenMessageMenuId(null);
        } catch {
            // ignore clipboard errors
        }
    };

    const copyMessageLink = async (messageId) => {
        try {
            const link = `${window.location.origin}/feed?channel=${channel?._id}&message=${messageId}`;
            await navigator.clipboard.writeText(link);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId((prev) => (prev === messageId ? null : prev)), 1200);
            setOpenMessageMenuId(null);
        } catch {
            // ignore clipboard errors
        }
    };

    const speakMessage = (content) => {
        if (!content || typeof window === 'undefined' || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(content);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setOpenMessageMenuId(null);
    };

    const handleCommentReaction = async (messageId, commentId, emoji) => {
        try {
            await reactToComment(channel._id, messageId, commentId, emoji);
        } catch { }
    };

    const handleLoadOlder = async () => {
        if (!channel?._id || !hasMoreMessages || isLoadingOlder) return;
        const container = scrollContainerRef.current;
        const prevHeight = container?.scrollHeight || 0;
        try {
            await loadOlderMessages(channel._id, 50);
        } catch {
            return;
        }
        requestAnimationFrame(() => {
            if (!container) return;
            const nextHeight = container.scrollHeight || 0;
            container.scrollTop = Math.max(0, nextHeight - prevHeight + container.scrollTop);
        });
    };

    const openReportModal = (message) => {
        setReportTarget(message);
        setReportReason('Spam');
        setReportDetails('');
        setReportError('');
        setShowReportModal(true);
    };

    const handleReportSubmit = async () => {
        if (!reportTarget?._id || !activeCommunityId) return;
        setIsReporting(true);
        setReportError('');
        try {
            const res = await fetch(apiUrl('/api/moderate/message/report'), {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-community-id': activeCommunityId,
                },
                body: JSON.stringify({
                    messageId: reportTarget._id,
                    reason: reportReason,
                    details: reportReason === 'Other' ? reportDetails.trim() : '',
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to report message');
            setShowReportModal(false);
        } catch (err) {
            setReportError(err.message || 'Failed to report message');
        } finally {
            setIsReporting(false);
        }
    };

    const renderContent = (content) => {
        if (!content) return null;
        const parts = [];
        const regex = /@([\w.-]+)/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const start = match.index;
            const end = regex.lastIndex;
            if (start > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, start) });
            parts.push({ type: 'mention', value: match[0], handle: match[1] });
            lastIndex = end;
        }
        if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
        return parts.map((part, idx) => {
            if (part.type === 'mention') {
                const isMe = part.handle.toLowerCase() === (currentUser?.username || '').toLowerCase();
                return (
                    <span
                        key={`${part.value}-${idx}`}
                        className={`px-1 rounded text-sm font-semibold ${isMe ? 'bg-blurple/20 text-blurple' : 'text-blurple'}`}
                    >
                        {part.value}
                    </span>
                );
            }
            return <span key={`text-${idx}`}>{part.value}</span>;
        });
    };

    const isAnnouncement = channel?.type === 'announcement';
    const canPost = !isAnnouncement || ['admin', 'moderator'].includes(currentUser?.communityRole);

    const typingLabel = useMemo(() => {
        if (typingUsers.length === 0) return '';
        const names = typingUsers.map((id) => memberMap.get(id)?.displayName || 'Someone');
        if (names.length === 1) return `${names[0]} is typing...`;
        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
        return `Several people are typing...`;
    }, [typingUsers, memberMap]);

    useEffect(() => {
        if (!showPins || !channel?._id) return;
        let active = true;
        const MIN_LOAD_MS = 250;
        const run = async () => {
            setPinsLoading(true);
            const started = Date.now();
            await fetchPinned(channel._id);
            const elapsed = Date.now() - started;
            const remaining = Math.max(0, MIN_LOAD_MS - elapsed);
            setTimeout(() => {
                if (active) setPinsLoading(false);
            }, remaining);
        };
        run();
        return () => { active = false; };
    }, [showPins, channel?._id, fetchPinned]);

    useEffect(() => {
        if (!scrollToMessageId) return;
        const node = document.getElementById(`message-${scrollToMessageId}`);
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setScrollTarget(null);
        }
    }, [scrollToMessageId, messages, setScrollTarget]);

    const handleSaveChannelName = async (name) => {
        if (!channel?._id || isSavingEdit) return;
        setEditError('');
        setIsSavingEdit(true);
        try {
            await updateChannelName(channel._id, name);
            handleCloseEdit();
        } catch (err) {
            setEditError(err.message || 'Failed to update channel');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDeleteChannel = async () => {
        if (!channel?._id || isDeleting) return;
        const ok = window.confirm(`Delete #${channel.name}? This cannot be undone.`);
        if (!ok) return;
        setEditError('');
        setIsDeleting(true);
        try {
            await deleteChannel(channel._id);
            handleCloseEdit();
        } catch (err) {
            setEditError(err.message || 'Failed to delete channel');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
        <div className="flex-1 min-h-0 flex flex-col bg-[#1a1a1e]">
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-6 bg-[#1a1a1e]">
                {isLoading || isSwitching ? (
                    <div className="text-sm text-discord-faint">Loading messages...</div>
                ) : error ? (
                    <div className="max-w-2xl rounded-xl border border-[#29292d]/55 bg-discord-darkest/70 p-5">
                        <p className="text-sm text-discord-light">{error}</p>
                        {canEditChannel && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="mt-4 px-3 py-2 rounded-md bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/30 cursor-pointer"
                            >
                                Edit Channel
                            </button>
                        )}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="max-w-2xl">
                        <div className="w-14 h-14 rounded-full bg-discord-darkest flex items-center justify-center text-3xl text-discord-faint mb-4">
                            <Hash />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Welcome to #{channel?.name || 'general'}!</h2>
                        <p className="text-sm text-discord-muted mt-2">
                            This is the start of the #{channel?.name || 'general'} channel.
                        </p>
                        {canEditChannel && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="mt-4 px-3 py-2 rounded-md bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/30 cursor-pointer"
                            >
                                Edit Channel
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-0">
                        {hasMoreMessages && (
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleLoadOlder}
                                    disabled={isLoadingOlder}
                                    className="px-3 py-1.5 rounded-md border border-[#29292d]/55 bg-discord-darkest/70 text-xs font-semibold text-discord-light hover:bg-discord-border-light/20 disabled:opacity-60"
                                >
                                    {isLoadingOlder ? 'Loading older messages...' : 'Load older messages'}
                                </button>
                            </div>
                        )}
                        {messages.map((m) => {
                            const sender = memberMap.get(m.senderId) || {};
                            const isMe = m.senderId === currentUser?.id;
                            const isLiked = (m.likedBy || []).some((id) => id === currentUser?.id);
                            const messageComments = commentsByMessage[m._id] || [];
                            const commentPaging = commentsPaging[m._id] || {};
                            const showComments = !!openComments[m._id];
                            return (
                                <div
                                    key={m._id}
                                    id={`message-${m._id}`}
                                    className="group relative flex gap-3 px-2 py-2 -mx-2 border-t border-[#29292d]/45 hover:bg-[#242428] transition-colors"
                                    onMouseEnter={() => setHoveredMessageId(m._id)}
                                    onMouseLeave={() => {
                                        if (openMessageMenuId !== m._id) setHoveredMessageId((prev) => (prev === m._id ? null : prev));
                                    }}
                                >
                                    {(hoveredMessageId === m._id || openMessageMenuId === m._id) && (
                                            <div className="absolute -top-4 right-0 z-20 flex items-center gap-1 rounded-lg border border-discord-border/70 bg-discord-darker p-1 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
                                            {CHAT_REACTION_EMOJIS.map((emoji) => (
                                                <button
                                                    key={`${m._id}-${emoji}`}
                                                    type="button"
                                                    onClick={() => toggleReaction(channel._id, m._id, emoji)}
                                                    className="h-8 w-8 rounded-md bg-discord-dark hover:bg-discord-border-light/60 transition-colors flex items-center justify-center"
                                                    title={`React ${emoji}`}
                                                >
                                                    <EmojiArt emoji={emoji} className="w-[18px] h-[18px]" />
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => handleReplyToMessage(m._id)}
                                                className="w-8 h-8 rounded-md flex items-center justify-center bg-discord-dark hover:bg-discord-border-light/60 text-discord-faint hover:text-discord-light"
                                                title="Reply"
                                            >
                                                <Reply className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleForwardMessage(m, sender)}
                                                className="w-8 h-8 rounded-md flex items-center justify-center bg-discord-dark hover:bg-discord-border-light/60 text-discord-faint hover:text-discord-light"
                                                title="Forward"
                                            >
                                                <Forward className="w-4 h-4" />
                                            </button>
                                            <div className="relative" ref={openMessageMenuId === m._id ? messageMenuRef : null}>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenMessageMenuId((prev) => (prev === m._id ? null : m._id))}
                                                    className="w-8 h-8 rounded-md flex items-center justify-center bg-discord-dark hover:bg-discord-border-light/60 text-discord-faint hover:text-discord-light"
                                                    title="More"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                                {openMessageMenuId === m._id && (
                                                    <div className="absolute right-0 top-10 w-64 rounded-lg border border-discord-border/80 bg-discord-darkest shadow-2xl p-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setReactionPickerMessageId((prev) => (prev === m._id ? null : m._id))}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-discord-border-light/30 flex items-center justify-between"
                                                        >
                                                            Add Reaction <ChevronRight className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <div className="my-1 h-px bg-discord-border/70" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReplyToMessage(m._id)}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-discord-border-light/30 flex items-center justify-between"
                                                        >
                                                            Reply <Reply className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleForwardMessage(m, sender)}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-discord-border-light/30 flex items-center justify-between"
                                                        >
                                                            Forward <Forward className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyMessageText(m._id, m.content || '')}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-discord-border-light/30 flex items-center justify-between"
                                                        >
                                                            Copy Text <Copy className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePin(channel._id, m._id)}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-discord-border-light/30 flex items-center justify-between"
                                                        >
                                                            Pin Message <Pin className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenMessageMenuId(null)}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-discord-border-light/30 flex items-center justify-between"
                                                        >
                                                            Mark Unread <Bell className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyMessageLink(m._id)}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-discord-border-light/30 flex items-center justify-between"
                                                        >
                                                            Copy Message Link <Link2 className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => speakMessage(m.content || '')}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                        >
                                                            Speak Message <Volume2 className="w-4 h-4 text-discord-faint" />
                                                        </button>
                                                        <div className="my-1 h-px bg-[#2b2d31]" />
                                                        <button
                                                            type="button"
                                                            onClick={() => openReportModal(m)}
                                                            className="w-full px-3 py-2 rounded-md text-left text-sm text-red-300 hover:bg-red-500/10 flex items-center justify-between"
                                                        >
                                                            Report Message <Flag className="w-4 h-4 text-red-300" />
                                                        </button>
                                                    </div>
                                                )}
                                                {reactionPickerMessageId === m._id && (
                                                    <EmojiPicker
                                                        onSelect={(emoji) => {
                                                            toggleReaction(channel._id, m._id, emoji);
                                                            setReactionPickerMessageId(null);
                                                            setOpenMessageMenuId(null);
                                                        }}
                                                        onClose={() => setReactionPickerMessageId(null)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="w-10 h-10 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold text-discord-light overflow-hidden">
                                        {sender.avatar ? (
                                            <img src={sender.avatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (sender.displayName || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-semibold ${isMe ? 'text-white' : 'text-discord-light'}`}>
                                                {sender.displayName || 'Member'}
                                            </span>
                                            <span className="text-xs text-discord-faint">{formatTime(m.createdAt)}</span>
                                        </div>
                                        <div className="text-sm text-discord-white mt-1 leading-relaxed">
                                            {renderContent(m.content)}
                                        </div>
                                        {copiedMessageId === m._id && (
                                            <div className="mt-1 text-[11px] text-emerald-300">Copied</div>
                                        )}
                                        {(m.reactions || []).length > 0 && (
                                            <div className="mt-2 flex items-center gap-1 flex-wrap">
                                                {(m.reactions || []).map((reaction) => {
                                                    const reacted = !!reaction.reacted;
                                                    return (
                                                        <button
                                                            key={`${m._id}-${reaction.emoji}`}
                                                            type="button"
                                                            onClick={() => toggleReaction(channel._id, m._id, reaction.emoji)}
                                                            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors inline-flex items-center gap-1 ${reacted ? 'bg-blurple/20 border-blurple/40 text-discord-white' : 'bg-discord-darkest border-discord-border text-discord-muted hover:text-discord-light'}`}
                                                        >
                                                            <EmojiArt emoji={reaction.emoji} className="w-3.5 h-3.5" />
                                                            <span>{reaction.count}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <div className="mt-2 text-xs text-discord-faint">
                                            {(isLiked || (m.likesCount || 0) > 0 || showComments || (m.commentsCount || 0) > 0) && (
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => toggleReaction(channel._id, m._id, '❤️')}
                                                        className={`flex items-center gap-1 hover:text-discord-light ${isLiked ? 'text-rose-400' : ''}`}
                                                    >
                                                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-400 text-rose-400' : ''}`} />
                                                        <span>{m.likesCount || 0}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleComment(m._id)}
                                                        className={`flex items-center gap-1 hover:text-discord-light ${showComments ? 'text-blurple' : ''}`}
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                        <span>{m.commentsCount || 0}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {m.mediaURLs?.length > 0 && (
                                            <div className="mt-3 grid grid-cols-1 gap-3 max-w-md">
                                                {m.mediaURLs.map((url) => {
                                                    const docUrls = m.mediaURLs.filter((candidate) => !isImageUrl(candidate));
                                                    const docIndex = docUrls.findIndex((candidate) => candidate === url);
                                                    return (
                                                    isImageUrl(url) ? (
                                                        <div key={url} className="rounded-lg border border-discord-border/40 overflow-hidden bg-discord-darkest">
                                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <AttachmentPreviewCard key={url} url={url} allUrls={docUrls} initialIndex={Math.max(0, docIndex)} />
                                                    )
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {showComments && (
                                            <div className="mt-4 rounded-lg border border-[#29292d]/55 bg-discord-darkest/60 p-3 space-y-3">
                                                {commentPaging.hasMore && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLoadOlderComments(m._id)}
                                                        disabled={commentPaging.isLoadingOlder}
                                                        className="px-2.5 py-1.5 rounded-md border border-[#29292d]/55 bg-discord-darkest/50 text-[11px] font-semibold text-discord-light hover:bg-discord-border-light/20 disabled:opacity-60"
                                                    >
                                                        {commentPaging.isLoadingOlder ? 'Loading older comments...' : 'Load older comments'}
                                                    </button>
                                                )}
                                                {commentsLoading[m._id] ? (
                                                    <div className="text-xs text-discord-faint">Loading comments...</div>
                                                ) : (
                                                    <>
                                                        {messageComments.length === 0 && (
                                                            <div className="text-xs text-discord-faint">No comments yet.</div>
                                                        )}
                                                        {messageComments.map((c) => (
                                                            <div key={c._id} className="flex gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-discord-border/40 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-discord-light">
                                                                    {c.author?.avatar ? (
                                                                        <img src={c.author.avatar} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        (c.author?.displayName || 'M').charAt(0).toUpperCase()
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-semibold text-discord-light">{c.author?.displayName || 'Member'}</div>
                                                                    <div className="text-xs text-discord-white/90">{c.content}</div>
                                                                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                        {(c.reactions || []).map((r) => (
                                                                            <button
                                                                                key={`${c._id}-${r.emoji}`}
                                                                                type="button"
                                                                                onClick={() => handleCommentReaction(m._id, c._id, r.emoji)}
                                                                                className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors inline-flex items-center gap-1 ${r.reacted ? 'bg-blurple/20 border-blurple/40 text-discord-white' : 'bg-discord-darkest border-discord-border text-discord-muted hover:text-discord-light'}`}
                                                                            >
                                                                                <EmojiArt emoji={r.emoji} className="w-3.5 h-3.5" />
                                                                                <span>{r.count}</span>
                                                                            </button>
                                                                        ))}
                                                                        {COMMENT_REACTIONS.map((emoji) => {
                                                                            const existing = (c.reactions || []).find((r) => r.emoji === emoji);
                                                                            if (existing) return null;
                                                                            return (
                                                                                <button
                                                                                    key={`${c._id}-add-${emoji}`}
                                                                                    type="button"
                                                                                    onClick={() => handleCommentReaction(m._id, c._id, emoji)}
                                                                                    className="px-2 py-0.5 rounded-full text-[10px] border bg-discord-darkest border-discord-border text-discord-faint hover:text-discord-light transition-colors inline-flex items-center"
                                                                                >
                                                                                    <EmojiArt emoji={emoji} className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        ref={(node) => { commentInputRefs.current[m._id] = node; }}
                                                        type="text"
                                                        value={commentDrafts[m._id] || ''}
                                                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [m._id]: e.target.value }))}
                                                        placeholder={canPost ? 'Add a comment' : 'Comments are restricted'}
                                                        disabled={!canPost}
                                                        className="flex-1 bg-discord-darkest/80 border border-[#29292d]/55 rounded-md px-2.5 py-1.5 text-xs text-discord-white placeholder:text-discord-faint/60 outline-none disabled:opacity-50"
                                                    />
                                                    <button
                                                        onClick={() => handleCommentSend(m._id)}
                                                        disabled={!canPost}
                                                        className="text-xs font-semibold text-blurple hover:text-blurple/80 disabled:opacity-50"
                                                    >
                                                        Send
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={endRef} />
                    </div>
                )}
            </div>

            <div className="px-4 pt-3 pb-3 border-t border-[#29292d]/45 bg-[#1a1a1e]">
                {typingLabel && (
                    <div className="text-xs text-discord-faint mb-2">{typingLabel}</div>
                )}

                {sendError && (
                    <div className="mb-2 rounded-lg border border-[#29292d]/55 bg-discord-red/10 px-3 py-2 text-xs text-discord-red">
                        {sendError}
                    </div>
                )}

                {!canPost && isAnnouncement && (
                    <div className="mb-3 rounded-lg border border-[#29292d]/55 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                        Announcements are read-only. Only admins and moderators can post here.
                    </div>
                )}

                {files.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {files.map((f) => (
                            <div key={f.id} className="relative w-20 h-20 rounded-lg border border-[#29292d]/55 bg-discord-darkest overflow-hidden">
                                {f.preview ? (
                                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-[10px] text-discord-faint px-1">
                                        <FileText className="w-4 h-4 mb-1" />
                                        <span className="text-center truncate w-full">{f.file.name}</span>
                                        <span className="text-[9px] opacity-70">{formatBytes(f.file.size)}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => removeFile(f.id)}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-discord-darkest/80 flex items-center justify-center hover:bg-discord-border/60"
                                >
                                    <X className="w-3 h-3 text-discord-light" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="relative flex items-center gap-2 h-12 bg-[#1f2229] border border-[#2b2e35] rounded-md px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                    <label className={`w-8 h-8 rounded-md flex items-center justify-center ${canPost ? 'hover:bg-[#2a2d35] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                        <Plus className="w-4 h-4 text-discord-muted" />
                        <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx"
                            className="hidden"
                            disabled={!canPost}
                            onChange={(e) => {
                                if (!canPost) return;
                                handleFiles(e.target.files);
                                e.target.value = '';
                            }}
                        />
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={text}
                        onChange={(e) => handleTextChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                if (e.nativeEvent?.isComposing) return;
                                e.preventDefault();
                                if (!canPost) return;
                                handleSend();
                            }
                        }}
                        onBlur={() => {
                            if (!channel?._id) return;
                            socket?.emit('channel:typing', { channelId: channel._id, userId: currentUser?.id, isTyping: false });
                        }}
                        placeholder={canPost ? `Message #${channel?.name || 'general'}` : 'Only admins and moderators can post here'}
                        disabled={!canPost}
                        className="flex-1 bg-transparent text-sm text-discord-white placeholder:text-discord-muted/80 outline-none"
                    />
                    <div className="flex items-center gap-2 text-discord-faint">
                        <button
                            onClick={() => setShowEmoji((s) => !s)}
                            disabled={!canPost}
                            className={`w-8 h-8 rounded-md flex items-center justify-center ${canPost ? 'hover:bg-[#2a2d35] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                        >
                            <Smile className="w-4 h-4" />
                        </button>
                        <button
                            disabled={isUploading || !canPost}
                            onClick={handleSend}
                            className="w-8 h-8 rounded-md hover:bg-[#2a2d35] flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>

                    {showMentions && filteredMentions.length > 0 && (
                        <div className="absolute left-3 bottom-14 w-64 rounded-lg bg-discord-darkest border border-[#29292d]/55 shadow-lg p-2 z-30">
                            <div className="text-[11px] text-discord-faint font-semibold px-2 py-1">Members</div>
                            <div className="space-y-1">
                                {filteredMentions.map((m) => (
                                    <button
                                        key={m._id}
                                        onClick={() => insertMention(m)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-discord-border-light/20 text-left"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-discord-border/40 overflow-hidden flex items-center justify-center text-xs font-semibold text-discord-light">
                                            {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : (m.displayName || 'M').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm text-discord-light truncate">{m.displayName}</div>
                                            <div className="text-[11px] text-discord-faint truncate">@{m.username}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {showEmoji && (
                        <EmojiPicker
                            onSelect={handleEmoji}
                            onClose={() => setShowEmoji(false)}
                        />
                    )}
                </div>
            </div>
        </div>
        {showReportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
                <div
                    className="w-[420px] max-w-[92vw] rounded-2xl bg-discord-darker border border-discord-border/50 shadow-2xl p-6 animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Report message</h2>
                            <p className="text-sm text-discord-muted mt-2">Select a reason for the report.</p>
                        </div>
                        <button
                            onClick={() => setShowReportModal(false)}
                            className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                        >
                            <X className="w-4 h-4 text-discord-faint" />
                        </button>
                    </div>

                    <div className="mt-4 grid gap-2">
                        {['Spam', 'Harassment', 'Hate Speech', 'Scam', 'Inappropriate Content', 'Other'].map((reason) => (
                            <button
                                key={reason}
                                onClick={() => setReportReason(reason)}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
                                    reportReason === reason
                                        ? 'border-blurple bg-blurple/15 text-white'
                                        : 'border-discord-border/50 bg-discord-darkest/70 text-discord-light hover:bg-discord-border-light/20'
                                }`}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>

                    {reportReason === 'Other' && (
                        <div className="mt-4">
                            <label className="block text-sm font-semibold mb-2">Details (optional)</label>
                            <textarea
                                value={reportDetails}
                                onChange={(e) => setReportDetails(e.target.value)}
                                rows={3}
                                className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple resize-none"
                                placeholder="Add more context"
                            />
                        </div>
                    )}

                    {reportError && (
                        <div className="mt-3 text-sm text-discord-red">{reportError}</div>
                    )}

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            onClick={() => setShowReportModal(false)}
                            className="px-5 py-2 rounded-lg bg-discord-border-light/30 text-sm font-semibold text-discord-white hover:bg-discord-border-light/50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReportSubmit}
                            disabled={isReporting}
                            className="px-5 py-2 rounded-lg bg-blurple text-sm font-semibold text-white hover:bg-blurple/90 disabled:opacity-50"
                        >
                            {isReporting ? 'Reporting...' : 'Submit'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        <PinnedMessagesModal
            isOpen={!!showPins}
            onClose={onClosePins}
            messages={pinnedMessages}
            resolveSender={(id) => memberMap.get(id)}
            isLoading={pinsLoading}
        />
        <ChannelEditModal
            isOpen={showEditModal}
            onClose={handleCloseEdit}
            channelName={channel?.name || ''}
            onSave={handleSaveChannelName}
            onDelete={handleDeleteChannel}
            isSaving={isSavingEdit}
            isDeleting={isDeleting}
            error={editError}
        />
        </>
    );
};

export default ChannelChat;
