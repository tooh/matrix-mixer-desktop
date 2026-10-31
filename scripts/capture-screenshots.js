const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

async function run() {
  await app.whenReady();

  const outDir = path.resolve(__dirname, '../docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const targets = [
    {
      role: 'ADMIN',
      url: 'http://localhost:3005/?role=admin',
      filename: 'role-1-admin.png'
    },
    {
      role: 'OPERATOR',
      url: 'http://localhost:3005/?role=operator',
      filename: 'role-2-operator.png'
    },
    {
      role: 'BAND_MEMBER',
      url: 'http://localhost:3005/?role=band',
      filename: 'role-3-band-member.png'
    }
  ];

  for (const item of targets) {
    console.log(`Capturing screenshot for role: ${item.role}...`);
    const ses = session.fromPartition(`persist:test-${item.role.toLowerCase()}-${Date.now()}`);
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

    // Wait 2.5s for fonts, CSS and fader states to render completely
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const image = await win.capturePage();
    const filePath = path.join(outDir, item.filename);
    fs.writeFileSync(filePath, image.toPNG());
    console.log(`Saved screenshot to: ${filePath}`);

    win.destroy();
  }

  console.log('All 3 distinct role screenshots captured successfully!');
  app.exit(0);
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
