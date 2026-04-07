import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Send, Hash, X, Image, BarChart3, Plus, Upload, Trash2, Crown } from 'lucide-react';
import Button from './Button';
import MentionInput from './MentionInput';
import { useFeedStore } from '../stores/feedStore';
import { useAuthStore } from '../stores/authStore';
import { useProfileStore } from '../stores/profileStore';
import { useChannelStore } from '../stores/channelStore';

const FILE_ACCEPT = {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    // Some browsers label documents as generic octet-stream.
    'application/octet-stream': ['.pdf', '.doc', '.docx', '.txt', '.csv', '.xls', '.xlsx', '.ppt', '.pptx'],
};

const TAG_OPTIONS = [
    'General', 'Question', 'Discussion', 'Showcase', 'Help',
    'React', 'Node.js', 'Design', 'DevOps', 'Career',
];

const TABS = [
    { id: 'post', label: 'Post', icon: Image },
    { id: 'poll', label: 'Poll', icon: BarChart3 },
];

const CreatePost = () => {
    const [activeTab, setActiveTab] = useState('post');
    const [content, setContent] = useState('');
    const [mentions, setMentions] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [showTags, setShowTags] = useState(false);
    const [error, setError] = useState('');

    const [files, setFiles] = useState([]);
    const [resourceLinks, setResourceLinks] = useState([{ url: '', label: '' }]);
    const [uploading, setUploading] = useState(false);

    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    const { createPost, uploadFile, isLoading } = useFeedStore();
    const { user } = useAuthStore();
    const { profile } = useProfileStore();
    const { activeChannelId } = useChannelStore();

    const initials = user?.name
        ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

    const onDrop = useCallback((acceptedFiles) => {
        const newFiles = acceptedFiles.map((file) =>
            Object.assign(file, { preview: URL.createObjectURL(file) })
        );
        setFiles((prev) => [...prev, ...newFiles].slice(0, 4));
        setError('');
    }, []);

    const onDropRejected = useCallback((rejections) => {
        const first = rejections?.[0];
        const reason = first?.errors?.[0]?.code;
        if (reason === 'file-too-large') {
            setError('File is too large. Maximum size is 10 MB per file.');
            return;
        }
        if (reason === 'file-invalid-type') {
            setError('Unsupported file type. Use images, PDF, DOC/DOCX, TXT, CSV, XLS/XLSX, or PPT/PPTX.');
            return;
        }
        setError('Some files could not be added. Please check type and size limits.');
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected,
        accept: FILE_ACCEPT,
        maxSize: 10 * 1024 * 1024,
        maxFiles: 4,
    });

    const updateResourceLink = (index, key, value) => {
        setResourceLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [key]: value } : link)));
    };

    const addResourceLink = () => {
        setResourceLinks((prev) => (prev.length >= 8 ? prev : [...prev, { url: '', label: '' }]));
    };

    const removeResourceLink = (index) => {
        setResourceLinks((prev) => {
            const next = prev.filter((_, i) => i !== index);
            return next.length > 0 ? next : [{ url: '', label: '' }];
        });
    };

    const removeFile = (index) => {
        setFiles((prev) => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[index].preview);
            updated.splice(index, 1);
            return updated;
        });
    };

    const addPollOption = () => { if (pollOptions.length < 6) setPollOptions([...pollOptions, '']); };
    const removePollOption = (index) => { if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, i) => i !== index)); };
    const updatePollOption = (index, value) => { const updated = [...pollOptions]; updated[index] = value; setPollOptions(updated); };
    const toggleTag = (tag) => { setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]); };

    const handleContentChange = useCallback((val, newMentions) => {
        setContent(val);
        if (newMentions) setMentions(newMentions);
        setError('');
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const mentionIds = mentions.map((m) => m._id);
        const hasResourceLink = resourceLinks.some((link) => link.url.trim());

        if (activeTab === 'post') {
            if (!content.trim() && files.length === 0 && !hasResourceLink) { setError('Write something, add a link, or attach media to share.'); return; }
            try {
                setUploading(true);
                const mediaURLs = [];
                for (const file of files) { const url = await uploadFile(file); mediaURLs.push(url); }
                const cleanedResourceLinks = resourceLinks
                    .map((link) => ({ url: link.url.trim(), label: link.label.trim() }))
                    .filter((link) => link.url);
                setUploading(false);
                await createPost({
                    content: content.trim(),
                    tags: selectedTags,
                    mediaURLs,
                    resourceLinks: cleanedResourceLinks,
                    channelId: activeChannelId,
                    mentions: mentionIds,
                });
                setContent(''); setSelectedTags([]); setShowTags(false); setFiles([]); setMentions([]); setResourceLinks([{ url: '', label: '' }]);
            } catch (err) {
                setUploading(false);
                setError(err?.message || 'Failed to upload or post files. Please try again.');
            }
        } else {
            if (!pollQuestion.trim()) { setError('Enter a poll question.'); return; }
            const validOptions = pollOptions.filter((o) => o.trim());
            if (validOptions.length < 2) { setError('Add at least 2 options.'); return; }
            try {
                await createPost({ content: content.trim(), tags: selectedTags, poll: { question: pollQuestion.trim(), options: validOptions.map((text) => text.trim()) }, channelId: activeChannelId, mentions: mentionIds });
                setContent(''); setSelectedTags([]); setShowTags(false); setPollQuestion(''); setPollOptions(['', '']); setActiveTab('post'); setMentions([]);
            } catch { }
        }
    };

    const busy = isLoading || uploading;

    return (
        <div className="relative bg-discord-darker/80 rounded-xl p-5 sm:p-6 border border-discord-border/50">
            <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                    {profile?.avatar ? (
                        <img src={profile.avatar} alt="" className={`w-10 h-10 rounded-full object-cover shadow-sm ${['premium', 'enterprise'].includes(profile?.tier) ? 'premium-ring' : 'border-2 border-discord-border'}`} />
                    ) : (
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blurple to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm ${['premium', 'enterprise'].includes(profile?.tier) ? 'premium-ring' : ''}`}>
                            {initials}
                        </div>
                    )}
                    {['premium', 'enterprise'].includes(profile?.tier) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center border-2 border-discord-darker">
                            <Crown className="w-2 h-2 text-white" strokeWidth={3} />
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="flex-1 min-w-0">
                    {/* Tabs */}
                    <div className="flex gap-1 mb-3 p-1 bg-discord-darkest/60 rounded-lg w-fit">
                        {TABS.map((tab) => (
                            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer select-none
                                    ${activeTab === tab.id
                                        ? 'bg-discord-border-light/30 text-discord-white shadow-sm'
                                        : 'text-discord-muted hover:text-discord-light'
                                    }`}>
                                <tab.icon className="w-3.5 h-3.5" strokeWidth={2} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Textarea with @mention support */}
                    <MentionInput
                        value={content}
                        onChange={handleContentChange}
                        mentions={mentions}
                        placeholder={activeTab === 'post' ? 'Share something with the community… (type @ to mention)' : 'Add context to your poll (optional)…'}
                        rows={activeTab === 'post' ? 3 : 2}
                    />

                    {/* Dropzone (post tab) */}
                    {activeTab === 'post' && (
                        <>
                            <div {...getRootProps()}
                                className={`mt-3 border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 cursor-pointer
                                    ${isDragActive
                                        ? 'border-blurple bg-blurple/5'
                                        : 'border-discord-border hover:border-blurple/50 hover:bg-blurple/[0.03]'}`}>
                                <input {...getInputProps()} />
                                <Upload className="w-5 h-5 text-discord-faint mx-auto mb-1.5" strokeWidth={1.5} />
                                <p className="text-xs text-discord-muted font-medium">
                                    {isDragActive ? 'Drop files here…' : 'Drag & drop files or click to browse'}
                                </p>
                                <p className="text-[10px] text-discord-faint mt-0.5">Images, PDF, DOC, DOCX, TXT, CSV, XLS/XLSX, PPT/PPTX · Max 10 MB · Up to 4 files</p>
                            </div>

                            {files.length > 0 && (
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    {files.map((file, i) => (
                                        <div key={i} className="relative group">
                                            {file.type.startsWith('image/') ? (
                                                <img src={file.preview} alt="" className="w-16 h-16 rounded-lg object-cover border-2 border-discord-border shadow-sm" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-discord-darkest flex items-center justify-center border-2 border-discord-border">
                                                    <span className="text-[10px] font-bold text-discord-muted uppercase">{file.name.split('.').pop()}</span>
                                                </div>
                                            )}
                                            <button type="button" onClick={() => removeFile(i)}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-discord-red text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm">
                                                <X className="w-3 h-3" strokeWidth={3} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3 p-3 bg-discord-darkest/60 rounded-lg border border-discord-border/60">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-discord-light">Resource links</p>
                                    <button
                                        type="button"
                                        onClick={addResourceLink}
                                        className="text-[11px] font-semibold text-blurple hover:text-blurple-hover transition-colors cursor-pointer"
                                    >
                                        + Add link
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {resourceLinks.map((link, i) => (
                                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
                                            <input
                                                type="url"
                                                value={link.url}
                                                onChange={(e) => updateResourceLink(i, 'url', e.target.value)}
                                                placeholder="https://resource-url"
                                                className="rounded-md bg-discord-darkest text-xs text-discord-white placeholder:text-discord-faint/60 border border-discord-border/70 px-3 py-2 outline-none focus:border-blurple focus:ring-2 focus:ring-blurple/20"
                                            />
                                            <input
                                                type="text"
                                                value={link.label}
                                                onChange={(e) => updateResourceLink(i, 'label', e.target.value)}
                                                placeholder="Label (optional)"
                                                className="rounded-md bg-discord-darkest text-xs text-discord-white placeholder:text-discord-faint/60 border border-discord-border/70 px-3 py-2 outline-none focus:border-blurple focus:ring-2 focus:ring-blurple/20"
                                                maxLength={120}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeResourceLink(i)}
                                                className="h-9 w-9 rounded-md hover:bg-discord-red/10 text-discord-faint hover:text-discord-red transition-colors cursor-pointer justify-self-start sm:justify-self-center"
                                                aria-label="Remove resource link"
                                            >
                                                <X className="w-4 h-4" strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Poll options */}
                    {activeTab === 'poll' && (
                        <div className="mt-3 space-y-2.5 animate-fade-in">
                            <input type="text" value={pollQuestion}
                                onChange={(e) => { setPollQuestion(e.target.value); setError(''); }}
                                placeholder="Ask a question…"
                                className="w-full rounded-lg bg-discord-darkest text-sm text-discord-white font-semibold placeholder:text-discord-faint/50 outline-none border border-discord-darkest transition-all duration-200 focus:border-blurple focus:ring-2 focus:ring-blurple/30 px-4 py-3" />
                            {pollOptions.map((opt, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full border-2 border-discord-border flex items-center justify-center text-[10px] font-bold text-discord-faint shrink-0">
                                        {i + 1}
                                    </div>
                                    <input type="text" value={opt}
                                        onChange={(e) => updatePollOption(i, e.target.value)}
                                        placeholder={`Option ${i + 1}`}
                                        className="flex-1 rounded-md bg-discord-darkest text-xs text-discord-white font-medium placeholder:text-discord-faint/50 outline-none border border-discord-darkest transition-all focus:border-blurple focus:ring-2 focus:ring-blurple/30 px-3 py-2.5" />
                                    {pollOptions.length > 2 && (
                                        <button type="button" onClick={() => removePollOption(i)}
                                            className="w-7 h-7 rounded-md hover:bg-discord-red/10 flex items-center justify-center transition-colors cursor-pointer">
                                            <Trash2 className="w-3.5 h-3.5 text-discord-red/60" strokeWidth={2} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {pollOptions.length < 6 && (
                                <button type="button" onClick={addPollOption}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-discord-muted hover:text-discord-light transition-colors cursor-pointer pl-7">
                                    <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add option
                                </button>
                            )}
                        </div>
                    )}

                    {error && <p className="mt-1.5 text-xs font-medium text-discord-red">{error}</p>}

                    {/* Selected tags */}
                    {selectedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedTags.map((tag) => (
                                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blurple/15 text-[11px] font-semibold text-blurple border border-blurple/20 hover:bg-blurple/25 transition-colors cursor-pointer">
                                    {tag} <X className="w-3 h-3" strokeWidth={2.5} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Tag picker */}
                    {showTags && (
                        <div className="flex flex-wrap gap-1.5 mt-3 p-3 bg-discord-darkest/60 rounded-lg animate-fade-in">
                            {TAG_OPTIONS.map((tag) => (
                                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 cursor-pointer select-none
                                        ${selectedTags.includes(tag)
                                            ? 'bg-blurple text-white shadow-sm'
                                            : 'bg-discord-darker text-discord-muted border border-discord-border hover:border-discord-border-light'
                                        }`}>
                                    {tag}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-3">
                        <button type="button" onClick={() => setShowTags(!showTags)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-discord-muted hover:text-discord-light transition-colors cursor-pointer">
                            <Hash className="w-3.5 h-3.5" strokeWidth={2} />
                            {showTags ? 'Hide tags' : 'Add tags'}
                        </button>

                        <Button type="submit" variant="primary" size="sm" loading={busy}
                            disabled={activeTab === 'post' ? (!content.trim() && files.length === 0 && !resourceLinks.some((link) => link.url.trim())) : !pollQuestion.trim()}
                            icon={!busy && <Send className="w-3.5 h-3.5" strokeWidth={2} />}>
                            {uploading ? 'Uploading…' : isLoading ? 'Posting…' : activeTab === 'poll' ? 'Post Poll' : 'Post'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePost;
