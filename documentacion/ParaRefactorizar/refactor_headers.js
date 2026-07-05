const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'app', 'modules');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir(baseDir, (filepath) => {
    if (filepath.endsWith('.html')) {
        let content = fs.readFileSync(filepath, 'utf8');
        const originalContent = content;

        // 1. Update existing styleClass in p-dialog
        content = content.replace(/styleClass="([^"]*modal[^"]*|p-fluid[^"]*|custom-patrimonio-dialog[^"]*)"/g, 'styleClass="app-custom-modal"');

        // 2. Add styleClass="app-custom-modal" to p-dialog that don't have it
        content = content.replace(/<p-dialog[^>]*>/g, (match) => {
            if (!match.includes('styleClass=')) {
                if (match.endsWith('/>')) {
                    return match.slice(0, -2) + ' styleClass="app-custom-modal"/>';
                } else {
                    return match.slice(0, -1) + ' styleClass="app-custom-modal">';
                }
            }
            return match;
        });

        // 3. Update card-header classes
        content = content.replace(/class="([^"]*card-header\s+bg-(?:primary|success|info|warning)[^"]*)"/g, 'class="card-header app-custom-header text-white"');
        content = content.replace(/class="card-header bg-white border-0 py-2"/g, 'class="card-header app-custom-header text-white"');
        content = content.replace(/class="card-header bg-white border-0 py-3"/g, 'class="card-header app-custom-header text-white"');

        // 4. Look for secondary headers/cards that just have class="card-header" without background
        // Wait, the user said "secondary cards/panel". 
        // We shouldn't replace *every* card-header because some might be broken layout. 
        // But let's replace `class="card-header"` with `class="card-header app-custom-header text-white"` if it doesn't already have a background.
        content = content.replace(/class="card-header"/g, 'class="card-header app-custom-header text-white"');

        // Note: the previous regex might cause duplicate classes if it matches `class="card-header app-custom-header text-white"`.
        // To be safe, we'll fix any accidental double class:
        content = content.replace(/class="card-header app-custom-header text-white app-custom-header text-white"/g, 'class="card-header app-custom-header text-white"');

        if (content !== originalContent) {
            fs.writeFileSync(filepath, content, 'utf8');
            console.log('Updated HTML: ' + filepath);
        }
    }
});
