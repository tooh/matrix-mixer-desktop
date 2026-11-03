const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = pkg.version;
const dmgPath = path.resolve(__dirname, `../release/Helix Matrix Mixer-${version}-arm64.dmg`);
const directAppPath = path.resolve(__dirname, '../release/mac-arm64/Helix Matrix Mixer.app');
const targetApp = '/Applications/Helix Matrix Mixer.app';

console.log(`\n=======================================================`);
console.log(`🚀 Installing Helix Matrix Mixer v${version} to /Applications...`);
console.log(`=======================================================`);

// 1. Terminate existing running instances of Helix Matrix Mixer
console.log('1️⃣  Stopping existing Helix Matrix Mixer instances...');
try {
  execSync('osascript -e \'quit app "Helix Matrix Mixer"\' 2>/dev/null || true');
  execSync('killall "Helix Matrix Mixer" 2>/dev/null || true');
  execSync('sleep 1.5');
} catch (e) {
  // Ignore
}

let sourceApp = '';
let mountPoint = '';

if (fs.existsSync(dmgPath)) {
  console.log(`2️⃣  Mounting DMG: ${path.basename(dmgPath)}...`);
  try {
    const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse`, { encoding: 'utf8' });
    const lines = mountOutput.trim().split('\n');
    const mountLine = lines.find(l => l.includes('/Volumes/'));
    if (mountLine) {
      mountPoint = mountLine.substring(mountLine.indexOf('/Volumes/')).trim();
      sourceApp = path.join(mountPoint, 'Helix Matrix Mixer.app');
      console.log(`   Mounted at: ${mountPoint}`);
    }
  } catch (e) {
    console.warn('⚠️ Could not mount DMG, falling back to direct app bundle if available:', e.message);
  }
}

if (!sourceApp || !fs.existsSync(sourceApp)) {
  if (fs.existsSync(directAppPath)) {
    console.log(`2️⃣  Using compiled application bundle from: ${directAppPath}`);
    sourceApp = directAppPath;
  } else {
    console.error(`❌ Neither DMG (${dmgPath}) nor compiled app bundle (${directAppPath}) was found.`);
    console.error(`Please run 'npm run dist:mac' or 'node build.js --install' first.`);
    process.exit(1);
  }
}

// 3. Install to /Applications
console.log(`3️⃣  Copying to ${targetApp}...`);
try {
  execSync(`rm -rf "${targetApp}"`);
  execSync(`cp -R "${sourceApp}" "${targetApp}"`);
  console.log('   Copied successfully!');
} catch (e) {
  console.error('❌ Failed to copy application to /Applications:', e);
  if (mountPoint) execSync(`hdiutil detach "${mountPoint}" || true`, { stdio: 'ignore' });
  process.exit(1);
}

// 4. Detach DMG if mounted
if (mountPoint) {
  console.log('4️⃣  Detaching DMG...');
  try {
    execSync(`hdiutil detach "${mountPoint}"`, { stdio: 'ignore' });
  } catch (e) {
    console.warn('⚠️ Warning: Could not detach DMG volume cleanly:', e.message);
  }
} else {
  console.log('4️⃣  (Direct app bundle install, no DMG unmount needed)');
}

// 5. Clear quarantine attributes
console.log('5️⃣  Clearing quarantine attributes (Gatekeeper bypass)...');
try {
  execSync(`xattr -cr "${targetApp}"`, { stdio: 'ignore' });
} catch (e) {}

// 6. Launch newly installed application
console.log(`6️⃣  Launching newly installed Helix Matrix Mixer v${version}...`);
try {
  execSync(`open "${targetApp}"`, { stdio: 'inherit' });
} catch (e) {
  console.error('❌ Failed to launch application:', e);
  process.exit(1);
}

// 7. Verify service restart
console.log('7️⃣  Verifying service is active on http://localhost:3005...');
let verified = false;
for (let i = 0; i < 15; i++) {
  try {
    const res = execSync('curl -s http://localhost:3005/version.txt', { encoding: 'utf8' }).trim();
    if (res === version) {
      console.log(`✅ Service is live and verified running v${res} on port 3005!\n`);
      verified = true;
      break;
    }
  } catch (e) {}
  execSync('sleep 1');
}

if (!verified) {
  console.warn('⚠️ Service did not report matching version within 15 seconds. Please check the running app.');
}
