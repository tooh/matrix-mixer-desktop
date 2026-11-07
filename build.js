const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const watch = process.argv.includes('--watch');
const install = process.argv.includes('--install');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const VERSION = pkg.version || '1.9.4';

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyAssets() {
  if (!fs.existsSync('dist/renderer')) {
    fs.mkdirSync('dist/renderer', { recursive: true });
  }

  // Read index.html and append version query param
  if (fs.existsSync('src/renderer/index.html')) {
    let indexHtml = fs.readFileSync('src/renderer/index.html', 'utf8');
    indexHtml = indexHtml.replace(/\/?index\.js(\?v=[^"]*)?/, `/index.js?v=${VERSION}`);
    indexHtml = indexHtml.replace(/\/?styles\.css(\?v=[^"]*)?/, `/styles.css?v=${VERSION}`);
    fs.writeFileSync('dist/renderer/index.html', indexHtml, 'utf8');
    console.log(`Copied: src/renderer/index.html -> dist/renderer/index.html (v=${VERSION})`);
  }

  copyFile('src/renderer/styles.css', 'dist/renderer/styles.css');
  copyFile('src/renderer/manifest.json', 'dist/renderer/manifest.json');
  if (fs.existsSync('src/renderer/sw.js')) {
    let swJs = fs.readFileSync('src/renderer/sw.js', 'utf8');
    swJs = swJs.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'matrixmixer-cache-v${VERSION}';`);
    fs.writeFileSync('dist/renderer/sw.js', swJs, 'utf8');
    fs.writeFileSync('src/renderer/sw.js', swJs, 'utf8');
    console.log(`Updated sw.js with CACHE_NAME v${VERSION}`);
  }
  copyFile('src/renderer/icon.png', 'dist/renderer/icon.png');
  copyDir('src/renderer/assets', 'dist/renderer/assets');

  // Ensure build resources directory exists for electron-builder with icons
  if (!fs.existsSync('build')) {
    fs.mkdirSync('build', { recursive: true });
  }
  copyFile('src/renderer/assets/app.icns', 'build/icon.icns');
  copyFile('src/renderer/icon.png', 'build/icon.png');

  // Also make sure dist/database has presets for initial seeding
  copyDir('database', 'dist/database');

  const versionPath = 'dist/renderer/version.txt';
  fs.writeFileSync(versionPath, VERSION, 'utf8');
  console.log(`Wrote: ${VERSION} -> ${versionPath}`);
}

async function run() {
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  if (!fs.existsSync('dist/electron')) {
    fs.mkdirSync('dist/electron', { recursive: true });
  }

  copyAssets();

  // 1. Electron Main & Preload Process Build
  console.log('⚡ Building Electron processes...');
  await esbuild.build({
    entryPoints: [
      'src/electron/main.ts',
      'src/electron/preload.ts'
    ],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outdir: 'dist/electron',
    external: ['electron', 'express', 'cors', 'dotenv', 'qrcode'],
    sourcemap: true
  });

  // 2. Server Build (Express)
  console.log('⚡ Building Express server...');
  await esbuild.build({
    entryPoints: ['src/main/main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/server.js',
    external: ['express', 'cors', 'dotenv', 'qrcode', 'electron'],
    sourcemap: true
  });

  // 3. Frontend React Build (Renderer)
  console.log('⚡ Building React renderer...');
  await esbuild.build({
    entryPoints: ['src/renderer/index.tsx'],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    outfile: 'dist/renderer/index.js',
    define: {
      'process.env.NODE_ENV': '"production"',
      '__APP_VERSION__': JSON.stringify(VERSION)
    },
    sourcemap: true
  });

  console.log('✅ Build complete!');

  // 4. Packaging and Local Installation (if --install flag is passed)
  if (install) {
    console.log('\n📦 Packaging application bundle with electron-builder...');
    try {
      execSync('npx electron-builder --mac --arm64', { stdio: 'inherit' });
    } catch (e) {
      console.warn('⚠️ electron-builder notice (will proceed with app bundle if generated):', e.message);
    }

    console.log('🚀 Running local installation to /Applications...');
    require('./scripts/install-dmg.js');
  }
}

run().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
