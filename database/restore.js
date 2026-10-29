const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'database');
const backupDir = path.join(projectRoot, 'backups');

const targetArg = process.argv[2];
let fileToRestore = null;

if (targetArg) {
  if (path.isAbsolute(targetArg)) {
    fileToRestore = targetArg;
  } else {
    fileToRestore = path.resolve(process.cwd(), targetArg);
  }
} else {
  // Grab latest backup
  const allBackups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup_matrix_mixer_') && f.endsWith('.json'))
    .sort();
  if (allBackups.length === 0) {
    console.error('❌ No backup files found in', backupDir);
    process.exit(1);
  }
  fileToRestore = path.join(backupDir, allBackups[allBackups.length - 1]);
}

if (!fs.existsSync(fileToRestore)) {
  console.error('❌ File not found:', fileToRestore);
  process.exit(1);
}

console.log(`Restoring from: ${fileToRestore}`);
const dump = JSON.parse(fs.readFileSync(fileToRestore, 'utf8'));

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

for (const [filename, content] of Object.entries(dump)) {
  if (content !== null) {
    const dest = path.join(dataDir, filename);
    fs.writeFileSync(dest, JSON.stringify(content, null, 2), 'utf8');
    console.log(`✓ Restored: ${dest}`);
  }
}

console.log('✓ Restore completed successfully!');
