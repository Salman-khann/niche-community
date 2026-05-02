const fs = require('fs');
const content = fs.readFileSync(process.argv[2], 'utf8');

let stack = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let tags = line.match(/<(div|button|span|section|main|aside|nav|header|footer|h1|h2|h3|h4|h5|h6|p|a|ul|ol|li|label|input|textarea|button|img|svg|path|br|hr|<>|<\/div>|<\/button>|<\/span>|<\/section>|<\/main>|<\/aside>|<\/nav>|<\/header>|<\/footer>|<\/h1>|<\/h2>|<\/h3>|<\/h4>|<\/h5>|<\/h6>|<\/p>|<\/a>|<\/ul>|<\/ol>|<\/li>|<\/label>|<\/input>|<\/textarea>|<\/button>|<\/img>|<\/svg>|<\/path>|<\/br>|<\/hr>|<\/>)/g);
    
    if (tags) {
        for (let tag of tags) {
            if (tag.startsWith('</')) {
                let closeType = tag.substring(2, tag.length - 1);
                if (stack.length === 0) {
                    console.log(`Error: Unmatched closing tag ${tag} at line ${i + 1}`);
                } else {
                    let open = stack.pop();
                    if (open.type !== closeType) {
                        console.log(`Error: Mismatched tags. Opened <${open.type}> at line ${open.line}, closed with ${tag} at line ${i + 1}`);
                    }
                }
            } else if (tag.endsWith('/>')) {
                // Self-closing, ignore
            } else {
                let openType = tag.substring(1, tag.length - 1);
                // Filter out self-closing tags like <img />, <input />, etc. that don't have />
                if (['img', 'input', 'br', 'hr'].includes(openType)) continue;
                stack.push({ type: openType, line: i + 1 });
            }
        }
    }
}

while (stack.length > 0) {
    let open = stack.pop();
    console.log(`Error: Unclosed tag <${open.type}> opened at line ${open.line}`);
}
