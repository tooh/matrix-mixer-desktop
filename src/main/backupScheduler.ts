import { spawn } from 'child_process';
import path from 'path';

export function startBackupScheduler() {
  const backupScript = path.resolve(process.cwd(), 'database/backup.js');

  function triggerBackup(daily: boolean = true) {
    const args = [backupScript];
    if (daily) args.push('--daily');

    const proc = spawn('node', args, { stdio: 'ignore' });
    proc.on('exit', (code) => {
      if (code === 0) {
        console.log(`[BackupScheduler] Automatic backup check completed successfully.`);
      }
    });
  }

  // Run on startup
  triggerBackup(true);

  // Interval check every hour
  setInterval(() => {
    triggerBackup(true);
  }, 3600 * 1000);
}
