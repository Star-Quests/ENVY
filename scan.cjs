const fs = require('fs');
const path = require('path');

// CONFIGURATION
const extensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.php', '.rb', '.go', '.java', '.c', '.cpp', '.h',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.cfg', '.conf',
    '.txt', '.md', '.rst', '.log',
    '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.env', '.gitignore', '.gitattributes', '.dockerignore', '.babelrc', '.eslintrc', '.prettierrc',
    'dockerfile', 'makefile', 'license', 'readme', 'contributing', 'changelog'
];

const excludeFolders = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage', 
    '.cache', 'out', 'public', 'vendor', 'venv', 'env', '__pycache__',
    'migrations', '.vscode', '.idea', 'static', 'media', 'uploads'
];

const maxSizeMB = 5;
const skipBinary = true; // Skip image, PDF, database files

const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg', '.pdf', '.db', '.sqlite', '.sqlite3', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.avi', '.mov', '.webm'];

// Setup
const projectPath = process.cwd();
const projectName = path.basename(projectPath);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputDir = path.join(projectPath, `${projectName}_snapshot_${timestamp}`);

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`\nScanning: ${projectPath}`);
console.log(`Output: ${outputDir}\n`);

// Get all files
function getAllFiles(dir, fileList = []) {
    try {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            
            try {
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    if (!excludeFolders.includes(file.toLowerCase())) {
                        getAllFiles(filePath, fileList);
                    }
                } else {
                    const ext = path.extname(file).toLowerCase();
                    const fileName = file.toLowerCase();
                    
                    // Skip binary files if configured
                    if (skipBinary && binaryExtensions.includes(ext)) {
                        return;
                    }
                    
                    // Check if file should be included
                    const hasMatchingExt = extensions.includes(ext);
                    const hasMatchingName = extensions.includes(fileName);
                    
                    if (hasMatchingExt || hasMatchingName) {
                        fileList.push(filePath);
                    }
                }
            } catch (err) {
                // Skip permission errors
            }
        });
    } catch (err) {
        console.log(`Cannot read: ${dir}`);
    }
    
    return fileList;
}

const allFiles = getAllFiles(projectPath);
console.log(`Found ${allFiles.length} files\n`);

if (allFiles.length === 0) {
    console.log('No matching files found!');
    process.exit(1);
}

// Process files
let fileIndex = 1;
let currentSize = 0;
let currentContent = '';
let processed = 0;
let skipped = 0;
const skippedList = [];

allFiles.forEach((filePath, index) => {
    try {
        let content;
        
        // Try UTF-8 first, fall back to latin1
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            content = fs.readFileSync(filePath, 'latin1');
        }
        
        const stats = fs.statSync(filePath);
        const relativePath = path.relative(projectPath, filePath);
        
        const header = `\n${'='.repeat(60)}\n` +
                      `FILE: ${relativePath}\n` +
                      `SIZE: ${(stats.size / 1024).toFixed(2)} KB\n` +
                      `MODIFIED: ${stats.mtime.toISOString()}\n` +
                      `${'='.repeat(60)}\n\n`;
        
        const block = header + content;
        const blockSize = Buffer.byteLength(block, 'utf8') / (1024 * 1024);
        
        if (currentSize + blockSize > maxSizeMB && currentContent) {
            const filename = path.join(outputDir, `project_part_${fileIndex}.txt`);
            fs.writeFileSync(filename, currentContent, 'utf8');
            console.log(`Created: project_part_${fileIndex}.txt (${currentSize.toFixed(2)} MB)`);
            fileIndex++;
            currentContent = '';
            currentSize = 0;
        }
        
        currentContent += block;
        currentSize += blockSize;
        processed++;
        
        if (processed % 20 === 0 || processed === allFiles.length) {
            process.stdout.write(`\rProcessing: ${processed}/${allFiles.length} (${Math.round(processed/allFiles.length*100)}%)`);
        }
        
    } catch (err) {
        skipped++;
        skippedList.push(`${path.relative(projectPath, filePath)}: ${err.message}`);
    }
});

// Write final file
if (currentContent) {
    const filename = path.join(outputDir, `project_part_${fileIndex}.txt`);
    fs.writeFileSync(filename, currentContent, 'utf8');
    console.log(`\nCreated: project_part_${fileIndex}.txt (${currentSize.toFixed(2)} MB)`);
}

// Write summary
const summary = `
========================================
SUMMARY
========================================
Project: ${projectPath}
Files found: ${allFiles.length}
Processed: ${processed}
Skipped: ${skipped}
Output files: ${fileIndex}
Output folder: ${outputDir}
========================================
`;

fs.writeFileSync(path.join(outputDir, 'summary.txt'), summary);

if (skippedList.length > 0) {
    fs.writeFileSync(path.join(outputDir, 'skipped.log'), skippedList.join('\n'));
}

console.log(summary);
console.log('✅ Done!');