const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = pkg.version;
const dmgPath = path.resolve(__dirname, `../release/Helix Matrix Mixer-${version}-arm64.dmg`);

console.log(`\n=======================================================`);
console.log(`🚀 Installing Helix Matrix Mixer v${version} from DMG...`);
console.log(`=======================================================`);

if (!fs.existsSync(dmgPath)) {
  console.error(`❌ DMG file not found at: ${dmgPath}`);
  console.error(`Please run 'npm run dist:mac' first.`);
  process.exit(1);
}

// 1. Terminate existing running instances of Helix Matrix Mixer
console.log('1️⃣  Stopping existing Helix Matrix Mixer instances...');
try {
  execSync('pkill -f "Helix Matrix Mixer" || true', { stdio: 'inherit' });
  // Small delay to allow port 3005 release
  execSync('sleep 1');
} catch (e) {
  // Ignore
}

// 2. Mount DMG
console.log(`2️⃣  Mounting DMG: ${path.basename(dmgPath)}...`);
let mountOutput = '';
try {
  mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse`, { encoding: 'utf8' });
} catch (e) {
  console.error('❌ Failed to mount DMG:', e);
  process.exit(1);
}

// Extract mount point (e.g. /Volumes/Helix Matrix Mixer 1.9.0-arm64)
const lines = mountOutput.trim().split('\n');
const mountLine = lines.find(l => l.includes('/Volumes/'));
if (!mountLine) {
  console.error('❌ Could not find mount point in hdiutil output:', mountOutput);
  process.exit(1);
}

const mountPoint = mountLine.substring(mountLine.indexOf('/Volumes/')).trim();
console.log(`   Mounted at: ${mountPoint}`);

const sourceApp = path.join(mountPoint, 'Helix Matrix Mixer.app');
const targetApp = '/Applications/Helix Matrix Mixer.app';

if (!fs.existsSync(sourceApp)) {
  console.error(`❌ Could not find application at: ${sourceApp}`);
  execSync(`hdiutil detach "${mountPoint}" || true`);
  process.exit(1);
}

// 3. Install to /Applications
console.log(`3️⃣  Copying to ${targetApp}...`);
try {
  execSync(`rm -rf "${targetApp}"`);
  execSync(`cp -R "${sourceApp}" "${targetApp}"`);
  console.log('   Copied successfully!');
} catch (e) {
  console.error('❌ Failed to copy application to /Applications:', e);
  execSync(`hdiutil detach "${mountPoint}" || true`);
  process.exit(1);
}

// 4. Detach DMG
console.log('4️⃣  Detaching DMG...');
try {
  execSync(`hdiutil detach "${mountPoint}"`, { stdio: 'ignore' });
} catch (e) {
  console.warn('⚠️ Warning: Could not detach DMG volume cleanly:', e.message);
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
