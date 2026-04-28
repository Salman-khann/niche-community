import React, { useState, useEffect, useMemo } from 'react';
import { X, Shield, ChevronRight, Hash, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

const PERMISSIONS_LIST = [
    { key: 'viewChannel', label: 'View Channel', description: 'Allows members to view this channel.' },
    { key: 'sendMessages', label: 'Send Messages', description: 'Allows members to send messages in this channel.' },
    { key: 'manageMessages', label: 'Manage Messages', description: 'Allows members to delete or pin messages.' },
    { key: 'connect', label: 'Connect', description: 'Allows members to connect to this voice channel.' },
    { key: 'speak', label: 'Speak', description: 'Allows members to speak in this voice channel.' },
];

const PermissionOverwriteItem = ({ permission, state, onChange, disabled }) => {
    return (
        <div className={`flex items-center justify-between py-3 border-b border-white/5 last:border-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
                <p className="text-sm font-semibold text-discord-white">{permission.label}</p>
                <p className="text-xs text-discord-muted">{permission.description}</p>
            </div>
            <div className="flex bg-discord-darkest rounded-lg p-1 border border-white/5 shrink-0 ml-4">
                {[
                    { val: 'deny', icon: <X className="w-3.5 h-3.5 text-discord-red" /> },
                    { val: 'inherit', icon: <ChevronRight className="w-3.5 h-3.5 text-discord-faint" /> },
                    { val: 'allow', icon: <Shield className="w-3.5 h-3.5 text-discord-green" /> }
                ].map((item) => (
                    <button
                        key={item.val}
                        onClick={() => onChange(item.val)}
                        className={`w-9 h-8 flex items-center justify-center rounded-md transition-all ${
                            state === item.val ? 'bg-discord-border/50 shadow-inner' : 'hover:bg-discord-border/20'
                        }`}
                    >
                        {item.icon}
                    </button>
                ))}
            </div>
        </div>
    );
};

const ChannelEditModal = ({ isOpen, onClose, channel, roles, onSave, onDelete, isSaving, isDeleting, error, onSyncToggle, onUpdateOverwrites }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedOverwriteId, setSelectedOverwriteId] = useState('@everyone');
    const [overwrites, setOverwrites] = useState(channel?.permissionOverwrites || []);
    const [name, setName] = useState(channel?.name || '');
    const [isSynced, setIsSynced] = useState(channel?.isSynced ?? true);

    useEffect(() => {
        if (isOpen && channel) {
            setName(channel.name);
            setOverwrites(channel.permissionOverwrites || []);
            setIsSynced(channel.isSynced ?? true);
        }
    }, [isOpen, channel]);

    if (!isOpen) return null;

    const activeOverwrite = useMemo(() => {
        if (selectedOverwriteId === '@everyone') {
            const ev = roles.find(r => r.name === '@everyone');
            return overwrites.find(o => o.id === ev?._id) || { id: ev?._id, type: 'role', allow: [], deny: [] };
        }
        return overwrites.find(o => o.id === selectedOverwriteId);
    }, [selectedOverwriteId, overwrites, roles]);

    const handlePermissionChange = (permKey, newState) => {
        const targetId = selectedOverwriteId === '@everyone' ? roles.find(r => r.name === '@everyone')?._id : selectedOverwriteId;
        if (!targetId) return;

        setOverwrites(prev => {
            const existingIdx = prev.findIndex(o => o.id === targetId);
            let nextOverwrites = [...prev];
            let target;

            if (existingIdx === -1) {
                target = { id: targetId, type: 'role', allow: [], deny: [] };
                nextOverwrites.push(target);
            } else {
                target = { ...nextOverwrites[existingIdx] };
                nextOverwrites[existingIdx] = target;
            }

            target.allow = target.allow.filter(k => k !== permKey);
            target.deny = target.deny.filter(k => k !== permKey);

            if (newState === 'allow') target.allow.push(permKey);
            if (newState === 'deny') target.deny.push(permKey);

            return nextOverwrites;
        });
        
        // If user manually changes a permission, we usually auto-unsync in Discord
        if (isSynced) setIsSynced(false);
    };

    const getPermissionState = (permKey) => {
        if (!activeOverwrite) return 'inherit';
        if (activeOverwrite.allow.includes(permKey)) return 'allow';
        if (activeOverwrite.deny.includes(permKey)) return 'deny';
        return 'inherit';
    };

    const handleSave = () => {
        onSave?.({
            name: name.trim(),
            isSynced,
            permissionOverwrites: overwrites
        });
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[80vh] bg-discord-chat rounded-2xl overflow-hidden flex shadow-2xl border border-white/5">
                {/* Left Sidebar */}
                <div className="w-60 bg-discord-sidebar p-4 flex flex-col">
                    <h2 className="text-xs font-bold text-discord-faint uppercase tracking-wider mb-4 px-2 flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5" />
                        Channel Settings
                    </h2>
                    <div className="flex-1 space-y-1">
                        <button 
                            onClick={() => setActiveTab('overview')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'overview' ? 'bg-discord-border text-white' : 'text-discord-muted hover:bg-discord-dark/40'}`}
                        >
                            Overview
                        </button>
                        <button 
                            onClick={() => setActiveTab('permissions')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'permissions' ? 'bg-discord-border text-white' : 'text-discord-muted hover:bg-discord-dark/40'}`}
                        >
                            Permissions
                        </button>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                         <button onClick={onDelete} className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-discord-red hover:bg-red-500/10">Delete Channel</button>
                    </div>
                </div>

                {/* Right Content */}
                <div className="flex-1 flex flex-col">
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 shrink-0">
                        <span className="text-sm font-bold text-discord-white uppercase tracking-tight">#{channel?.name} Settings — {activeTab}</span>
                        <button onClick={onClose} className="text-discord-faint hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        {activeTab === 'overview' && (
                            <div className="max-w-xl space-y-8">
                                <div>
                                    <label className="text-xs font-bold text-discord-faint uppercase mb-2 block">Channel Name</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-discord-faint">
                                            <Hash className="w-4 h-4" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-discord-darkest rounded-lg border border-white/5 py-2.5 pl-10 pr-4 text-sm text-discord-white focus:outline-none focus:border-blurple/50"
                                        />
                                    </div>
                                    {error && <p className="text-discord-red text-xs mt-2">{error}</p>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'permissions' && (
                            <div className="flex flex-col h-full gap-6">
                                {/* Sync Status Banner */}
                                <div className={`p-4 rounded-xl border flex items-center justify-between ${isSynced ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                    <div className="flex items-center gap-3">
                                        {isSynced ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                                        <div>
                                            <p className="text-[13px] font-bold text-white">
                                                {isSynced ? 'Permissions Synced' : 'Permissions Not Synced'}
                                            </p>
                                            <p className="text-xs text-discord-muted">
                                                {isSynced 
                                                    ? 'This channel is following the permissions of its parent category.' 
                                                    : 'This channel has custom permissions that differ from its parent category.'}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsSynced(!isSynced)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSynced ? 'bg-amber-600/20 text-amber-500 hover:bg-amber-600/30' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                                    >
                                        {isSynced ? 'Unsync' : 'Sync Now'}
                                    </button>
                                </div>

                                <div className="flex flex-1 gap-6 min-h-0">
                                    {/* Role/Member List */}
                                    <div className="w-48 shrink-0 flex flex-col">
                                        <h3 className="text-xs font-bold text-discord-faint uppercase mb-2">Roles/Members</h3>
                                        <div className="flex-1 overflow-y-auto space-y-1">
                                            <button 
                                                onClick={() => setSelectedOverwriteId('@everyone')}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${selectedOverwriteId === '@everyone' ? 'bg-discord-darkest text-white' : 'text-discord-muted hover:bg-discord-dark/40'}`}
                                            >
                                                @everyone
                                            </button>
                                            {roles.filter(r => r.name !== '@everyone').map(role => (
                                                <button 
                                                    key={role._id}
                                                    onClick={() => setSelectedOverwriteId(role._id)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${selectedOverwriteId === role._id ? 'bg-discord-darkest text-white' : 'text-discord-muted hover:bg-discord-dark/40'}`}
                                                >
                                                    {role.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Permissions Scroller */}
                                    <div className="flex-1 bg-discord-darkest/40 rounded-xl border border-white/5 p-4 overflow-y-auto">
                                        {PERMISSIONS_LIST.map(perm => (
                                            <PermissionOverwriteItem 
                                                key={perm.key}
                                                permission={perm}
                                                state={getPermissionState(perm.key)}
                                                onChange={(s) => handlePermissionChange(perm.key, s)}
                                                disabled={isSynced}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-discord-sidebar border-t border-white/5 flex items-center justify-end gap-3 shrink-0">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-white hover:underline transition-all">Cancel</button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-blurple hover:bg-blurple-hover text-white px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChannelEditModal;
