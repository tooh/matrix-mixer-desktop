import fs from 'fs';
import path from 'path';
import { getDataDir } from './db';

export function runBackup(daily: boolean = true) {
  try {
    const dataDir = getDataDir();
    const backupDir = path.join(dataDir, 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const dateDay = now.toISOString().slice(0, 10).replace(/-/g, '');

    if (daily) {
      const existingToday = fs.readdirSync(backupDir).some(f => f.startsWith(`backup_matrix_mixer_${dateDay}`));
      if (existingToday) {
        console.log(`[BackupScheduler] Daily backup for ${dateDay} already exists. Skipped.`);
        return;
      }
    }

    const backupFile = path.join(backupDir, `backup_matrix_mixer_${dateStr}.json`);
    const dataFiles = ['presets.json', 'settings.json', 'users.json', 'audit_logs.json'];
    const dump: Record<string, any> = {};

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
    console.log(`[BackupScheduler] Automatic backup check completed successfully.`);

    // Retention: keep last 14 backups
    const allBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_matrix_mixer_') && f.endsWith('.json'))
      .sort();

    if (allBackups.length > 14) {
      const toDelete = allBackups.slice(0, allBackups.length - 14);
      for (const f of toDelete) {
        try {
          fs.unlinkSync(path.join(backupDir, f));
          console.log(`[BackupScheduler] Cleaned up old backup: ${f}`);
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[BackupScheduler] Backup warning:', err);
  }
}

export function startBackupScheduler() {
  // Run on startup safely in background
  setTimeout(() => {
    runBackup(true);
  }, 1000);

  // Interval check every hour
  setInterval(() => {
    runBackup(true);
  }, 3600 * 1000);
}
