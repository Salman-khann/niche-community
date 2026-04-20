const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ProfilePopout.jsx', 'utf8');

// Find where <div className="fixed inset-0 z-[70]" onClick={onClose}> ends.
// In the original file, there was code nested after it for showStatusMenu and showCustomStatus.
// Let's strip those off.

const idx = code.indexOf('{showStatusMenu && (');
if (idx > -1) {
    const endDivIdx = code.indexOf('</div>\n        </div>', idx);
    code = code.substring(0, idx) + '        </div>\n    );\n};\n\nexport default ProfilePopout;';
    fs.writeFileSync('frontend/src/components/ProfilePopout.jsx', code, 'utf8');
    console.log('Stripped overlapping status blocks at end.');
}
