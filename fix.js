const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/ServerSettingsPage.jsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes(\) : activeSettingsTab === 'bans' ? (\));
console.log(start);
const end = lines.findIndex((l, i) => i > start && l.includes('</main>'));
console.log(end);
console.log(lines.slice(end - 10, end + 2).join('\n'));

