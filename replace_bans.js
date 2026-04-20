const fs = require('fs');

const path = 'frontend/src/pages/ServerSettingsPage.jsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes(") : activeSettingsTab === 'bans' ? ("));
let endIdx = -1;

for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes(") : (")) {
        endIdx = i;
        break;
    }
}

const pre = lines.slice(0, startIdx + 1).join('\n');
const post = lines.slice(endIdx).join('\n');

const bansJsx = `                            <div className="space-y-6">
                                <div className="rounded-xl border border-discord-border/40 bg-discord-darkest/60 px-5 py-4">
                                    <h3 className="text-sm font-semibold text-discord-white">Banned Members</h3>
                                    <p className="text-xs text-discord-faint mt-2 mb-4">
                                        Members who are banned cannot join this server until the ban is revoked.
                                    </p>
                                    <div className="divide-y divide-discord-border/30">
                                        {members.filter(m => m.isBanned).length === 0 ? (
                                            <div className="text-sm text-discord-faint py-4 text-center">No banned members.</div>
                                        ) : (
                                            members.filter(m => m.isBanned).map(m => (
                                                <div key={m._id} className="py-3 flex flex-row items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-discord-darkest flex items-center justify-center overflow-hidden text-sm font-semibold relative">
                                                        {m.avatar ? (
                                                            <img
                                                                src={m.avatar}
                                                                alt={m.name}
                                                                className="w-full h-full object-cover"
                                                                referrerPolicy="no-referrer"
                                                            />
                                                        ) : (
                                                            (m.name || 'U').charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-discord-white">{m.name}</p>
                                                            <p className="text-xs text-discord-faint">{m.email}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await unbanMember(activeCommunityId, m._id);
                                                            } catch (err) {
                                                                console.error("Failed to unban:", err);
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-discord-darker border border-discord-border/50 hover:bg-discord-red/10 text-discord-red rounded text-xs font-semibold"
                                                    >
                                                        Revoke Ban
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>`;

fs.writeFileSync(path, pre + '\n' + bansJsx + '\n' + post, 'utf8');
console.log('Replaced with new Bans block');
