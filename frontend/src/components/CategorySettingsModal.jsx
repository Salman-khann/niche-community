import React, { useState, useMemo } from 'react';
import { X, Shield, User, ChevronRight, Lock, Hash, Volume2 } from 'lucide-react';

const PERMISSIONS_LIST = [
    { key: 'viewChannel', label: 'View Channel', description: 'Allows members to view this channel.' },
    { key: 'sendMessages', label: 'Send Messages', description: 'Allows members to send messages in this channel.' },
    { key: 'manageMessages', label: 'Manage Messages', description: 'Allows members to delete or pin messages.' },
    { key: 'connect', label: 'Connect', description: 'Allows members to connect to this voice channel.' },
    { key: 'speak', label: 'Speak', description: 'Allows members to speak in this voice channel.' },
];

const PermissionOverwriteItem = ({ permission, state, onChange }) => {
    // state: 'allow' | 'deny' | 'inherit'
    return (
        <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <div>
                <p className="text-sm font-semibold text-discord-white">{permission.label}</p>
                <p className="text-xs text-discord-muted">{permission.description}</p>
            </div>
            <div className="flex bg-discord-darkest rounded-lg p-1 border border-white/5">
                {[
                    { val: 'deny', icon: <X className="w-4 h-4 text-discord-red" />, label: 'Deny' },
                    { val: 'inherit', icon: <ChevronRight className="w-4 h-4 text-discord-faint" />, label: 'Inherit' },
                    { val: 'allow', icon: <Shield className="w-4 h-4 text-discord-green" />, label: 'Allow' }
                ].map((item) => (
                    <button
                        key={item.val}
                        onClick={() => onChange(item.val)}
                        className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-2 ${
                            state === item.val ? 'bg-discord-border/50 shadow-inner' : 'hover:bg-discord-border/20'
                        }`}
                        title={item.label}
                    >
                        {item.icon}
                    </button>
                ))}
            </div>
        </div>
    );
};

const CategorySettingsModal = ({ isOpen, onClose, category, roles, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedOverwriteId, setSelectedOverwriteId] = useState('@everyone');
    const [overwrites, setOverwrites] = useState(category?.permissionOverwrites || []);
    const [name, setName] = useState(category?.name || '');

    if (!isOpen) return null;

    // Derived: active overwrite
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
                target = { id: targetId, type: selectedOverwriteId === '@everyone' ? 'role' : 'role', allow: [], deny: [] };
                nextOverwrites.push(target);
            } else {
                target = { ...nextOverwrites[existingIdx] };
                nextOverwrites[existingIdx] = target;
            }

            // Remove permKey from both
            target.allow = target.allow.filter(k => k !== permKey);
            target.deny = target.deny.filter(k => k !== permKey);

            if (newState === 'allow') target.allow.push(permKey);
            if (newState === 'deny') target.deny.push(permKey);

            return nextOverwrites;
        });
    };

    const getPermissionState = (permKey) => {
        if (!activeOverwrite) return 'inherit';
        if (activeOverwrite.allow.includes(permKey)) return 'allow';
        if (activeOverwrite.deny.includes(permKey)) return 'deny';
        return 'inherit';
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[80vh] bg-discord-chat rounded-2xl overflow-hidden flex shadow-2xl border border-white/5">
                {/* Left Sidebar */}
                <div className="w-60 bg-discord-sidebar p-4 space-y-1">
                    <h2 className="text-xs font-bold text-discord-faint uppercase tracking-wider mb-4 px-2">Category Settings</h2>
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'overview' ? 'bg-discord-border text-white' : 'text-discord-muted hover:bg-[#1a1c22]'}`}
                    >
                        Overview
                    </button>
                    <button 
                        onClick={() => setActiveTab('permissions')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'permissions' ? 'bg-discord-border text-white' : 'text-discord-muted hover:bg-[#1a1c22]'}`}
                    >
                        Permissions
                    </button>
                    <div className="pt-4 mt-4 border-t border-white/5">
                         <button className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-discord-red hover:bg-red-500/10">Delete Category</button>
                    </div>
                </div>

                {/* Right Content */}
                <div className="flex-1 flex flex-col bg-discord-chat">
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 shrink-0">
                        <span className="text-sm font-bold text-discord-white">{activeTab === 'overview' ? 'Overview' : 'Permissions'} — {category?.name}</span>
                        <button onClick={onClose} className="text-discord-faint hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'overview' && (
                            <div className="max-w-xl space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-discord-faint uppercase mb-2 block">Category Name</label>
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-discord-darkest rounded-lg border border-white/5 p-3 text-sm text-discord-white focus:outline-none focus:border-blurple/50 shadow-inner"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'permissions' && (
                            <div className="flex h-full gap-6">
                                {/* Role/Member List */}
                                <div className="w-48 shrink-0 flex flex-col">
                                    <h3 className="text-xs font-bold text-discord-faint uppercase mb-2">Roles/Members</h3>
                                    <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                        <button 
                                            onClick={() => setSelectedOverwriteId('@everyone')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${selectedOverwriteId === '@everyone' ? 'bg-[#313338] text-white' : 'text-discord-muted hover:bg-[#1a1c22]'}`}
                                        >
                                            @everyone
                                        </button>
                                        {roles.filter(r => r.name !== '@everyone').map(role => (
                                            <button 
                                                key={role._id}
                                                onClick={() => setSelectedOverwriteId(role._id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${selectedOverwriteId === role._id ? 'bg-[#313338] text-white' : 'text-discord-muted hover:bg-[#1a1c22]'}`}
                                            >
                                                {role.name}
                                            </button>
                                        ))}
                                    </div>
                                    <button className="mt-4 px-3 py-2 rounded-lg bg-blurple text-[10px] font-bold text-white hover:bg-blurple-hover uppercase">Add Member/Role</button>
                                </div>

                                {/* Permissions Scroller */}
                                <div className="flex-1 bg-discord-darkest/40 rounded-xl border border-white/5 p-4 overflow-y-auto">
                                    <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-blurple/10 border border-blurple/20">
                                        <Shield className="w-5 h-5 text-blurple" />
                                        <p className="text-xs text-discord-light">
                                            Permissions set here will apply to all channels in this category, unless they are overridden specifically.
                                        </p>
                                    </div>
                                    {PERMISSIONS_LIST.map(perm => (
                                        <PermissionOverwriteItem 
                                            key={perm.key}
                                            permission={perm}
                                            state={getPermissionState(perm.key)}
                                            onChange={(s) => handlePermissionChange(perm.key, s)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-discord-darkest border-t border-white/5 flex items-center justify-end gap-3 shrink-0">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-discord-white hover:underline transition-all font-medium">Cancel</button>
                        <button 
                            onClick={() => onUpdate({ name, permissionOverwrites: overwrites })}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategorySettingsModal;
