const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'database');
const backupDir = path.join(projectRoot, 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const isDaily = process.argv.includes('--daily');
const now = new Date();
const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const dateDay = now.toISOString().slice(0, 10).replace(/-/g, '');

if (isDaily) {
  const existingToday = fs.readdirSync(backupDir).some(f => f.startsWith(`backup_matrix_mixer_${dateDay}`));
  if (existingToday) {
    console.log(`ℹ️ Daily backup for ${dateDay} already exists. Skipped.`);
    process.exit(0);
  }
}

const backupFile = path.join(backupDir, `backup_matrix_mixer_${dateStr}.json`);

const dataFiles = ['presets.json', 'settings.json', 'users.json', 'audit_logs.json'];
const dump = {};

for (const file of dataFiles) {
  const filePath = path.join(dataDir, file);
  if (fs.existsSync(filePath)) {
    try {
      dump[file] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      dump[file] = null;
    }
  } else {
    dump[file] = null;
  }
}

fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), 'utf8');
console.log(`✓ Backup successfully saved to: ${backupFile}`);

// Retention: keep last 14 backups
const allBackups = fs.readdirSync(backupDir)
  .filter(f => f.startsWith('backup_matrix_mixer_') && f.endsWith('.json'))
  .sort();

if (allBackups.length > 14) {
  const toDelete = allBackups.slice(0, allBackups.length - 14);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(backupDir, f));
    console.log(`ℹ️ Cleaned up old backup: ${f}`);
  }
}
