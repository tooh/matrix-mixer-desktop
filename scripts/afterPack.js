const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function (context) {
  if (context.electronPlatformName === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    const appPath = path.join(context.appOutDir, appName);

    if (fs.existsSync(appPath)) {
      console.log(`\n  ⚡ [afterPack] Ad-hoc signing macOS application bundle at: ${appPath}`);
      try {
        execSync(`codesign --force --deep --sign - "${appPath}"`, {
          stdio: 'inherit'
        });
        console.log(`  ✅ [afterPack] Successfully ad-hoc signed: ${appName}\n`);
      } catch (err) {
        console.error(`  ❌ [afterPack] Failed to codesign ${appPath}:`, err);
        throw err;
      }
    } else {
      console.warn(`  ⚠️ [afterPack] App bundle not found at: ${appPath}`);
    }
  }
};
