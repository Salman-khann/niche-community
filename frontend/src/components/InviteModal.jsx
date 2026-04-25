import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, X } from 'lucide-react';

const InviteModal = ({ isOpen, onClose, communityName, friends = [], onGenerateInvite, onSendInvite }) => {
    const [email, setEmail] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleGenerate = async (targetEmail) => {
        setLoading(true);
        setMessage('');
        try {
            const data = await onGenerateInvite?.(targetEmail || undefined);
            const code = data?.code;
            if (code) {
                const link = `${window.location.origin}/invite-link?code=${code}`;
                setInviteLink(link);
            }
            setMessage(data?.message || 'Invite created');
        } catch (err) {
            setMessage(err.message || 'Failed to create invite');
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvite = async (friend) => {
        if (!friend?._id) return;
        setLoading(true);
        setMessage('');
        try {
            const data = await onSendInvite?.(friend._id);
            setMessage(data?.message || `Invite sent to ${friend.displayName || 'friend'}`);
        } catch (err) {
            setMessage(err.message || 'Failed to send invite');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!inviteLink) return;
        await navigator.clipboard.writeText(inviteLink);
        setMessage('Invite code copied');
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="w-[560px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl p-6 animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">Invite friends to {communityName}</h2>
                        <p className="text-sm text-discord-muted mt-1">Recipients will land in the default channel.</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer">
                        <X className="w-4 h-4 text-discord-faint" />
                    </button>
                </div>

                <div className="mt-4 max-h-[320px] overflow-y-auto space-y-2">
                    {friends.map((f) => (
                        <div key={f._id} className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-discord-border-light/10">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold text-discord-light">
                                    {f.avatar ? <img src={f.avatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : (f.displayName || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{f.displayName}</p>
                                    <p className="text-[11px] text-discord-faint">{f.username || ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleSendInvite(f)}
                                disabled={loading}
                                className="px-3 py-1.5 rounded-md bg-discord-darkest text-xs font-semibold text-discord-light hover:bg-discord-border-light/30 disabled:opacity-60 cursor-pointer"
                            >
                                Invite
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t border-discord-border/40">
                    <p className="text-sm text-discord-light mb-2">Generate an invite code for new members</p>
                    <div className="flex items-center gap-2">
                        <input
                            value={inviteLink}
                            readOnly
                            placeholder="Generate an invite code"
                            className="flex-1 px-3 py-2 rounded-md bg-discord-darkest text-sm text-discord-white font-mono placeholder:text-discord-faint/60 border border-discord-darkest"
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => handleGenerate()}
                            disabled={loading}
                            className="px-4 py-2 rounded-md bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/30 disabled:opacity-60 cursor-pointer"
                        >
                            Generate
                        </button>
                        <button 
                            onClick={handleCopy} 
                            disabled={!inviteLink}
                            className="px-4 py-2 rounded-md bg-blurple text-sm font-semibold text-white hover:bg-blurple/90 disabled:opacity-50 cursor-pointer"
                        >
                            Copy Code
                        </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Send invite code to email"
                            className="flex-1 px-3 py-2 rounded-md bg-discord-darkest text-sm text-discord-white placeholder:text-discord-faint/60 border border-discord-darkest"
                        />
                        <button
                            onClick={() => handleGenerate(email)}
                            disabled={loading}
                            className="px-4 py-2 rounded-md bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/30 disabled:opacity-60 cursor-pointer"
                        >
                            Send
                        </button>
                    </div>
                    {message && <p className="mt-2 text-xs text-discord-faint">{message}</p>}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default InviteModal;
