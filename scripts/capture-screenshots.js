const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

const PORT = 3999;

const targets = {
  admin: {
    role: 'ADMIN',
    url: `http://localhost:${PORT}/?role=admin&layer=quarter_inch&bank=all`,
    filename: 'role-1-admin.png'
  },
  operator: {
    role: 'OPERATOR',
    url: `http://localhost:${PORT}/?role=operator&layer=xlr&bank=stems`,
    filename: 'role-2-operator.png'
  },
  band: {
    role: 'BAND_MEMBER',
    url: `http://localhost:${PORT}/?role=band&layer=phones&bank=vocal`,
    filename: 'role-3-band-member.png'
  }
};

const targetKey = process.argv[2] || 'all';

async function run() {
  await app.whenReady();

  // Start fresh server with newest dist bundle
  const { startServer } = require('../dist/server.js');
  try {
    await startServer(PORT);
  } catch (e) {}

  const outDir = path.resolve(__dirname, '../docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const items = targetKey === 'all' ? Object.values(targets) : [targets[targetKey]];
  if (!items[0]) {
    console.error('Invalid target. Choose admin, operator, or band');
    app.exit(1);
    return;
  }

  for (const item of items) {
    console.log(`[Screenshot] Capturing ${item.role} -> ${item.filename}...`);
    const ses = session.fromPartition(`persist:shot-${item.role.toLowerCase()}-${Date.now()}`);
    await ses.clearCache();
    await ses.clearStorageData();

    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      webPreferences: {
        session: ses,
        contextIsolation: false
      }
    });

    await win.loadURL(item.url);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const image = await win.capturePage();
    const filePath = path.join(outDir, item.filename);
    const pngBuf = image.toPNG();
    fs.writeFileSync(filePath, pngBuf);
    console.log(`[Screenshot] Successfully wrote ${item.filename} (${pngBuf.length} bytes)`);

    win.destroy();
  }

  app.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
