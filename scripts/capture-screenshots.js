const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable hardware acceleration for headless/offscreen capture
app.disableHardwareAcceleration();

async function run() {
  await app.whenReady();

  // Start the server if needed
  const { startServer } = require('../dist/server.js');
  const server = await startServer(3899);

  const outDir = path.resolve(__dirname, '../docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  const roles = [
    {
      role: 'ADMIN',
      user: { id: 'usr-admin', name: 'System Administrator', role: 'ADMIN' },
      filename: 'role-1-admin.png'
    },
    {
      role: 'OPERATOR',
      user: { id: 'usr-foh', name: 'FOH Sound Engineer', role: 'OPERATOR' },
      filename: 'role-2-operator.png'
    },
    {
      role: 'BAND_MEMBER',
      user: { id: 'usr-band', name: 'Band Member (IEM)', role: 'BAND_MEMBER' },
      filename: 'role-3-band-member.png'
    }
  ];

  for (const item of roles) {
    console.log(`Capturing screenshot for role: ${item.role}...`);
    await win.loadURL('http://localhost:3899');
    await win.webContents.executeJavaScript(`
      localStorage.setItem('matrix_mixer_user', JSON.stringify(${JSON.stringify(item.user)}));
    `);
    await win.loadURL('http://localhost:3899');
    
    // Give time for React components, SVG and styling to fully render
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const image = await win.capturePage();
    const filePath = path.join(outDir, item.filename);
    fs.writeFileSync(filePath, image.toPNG());
    console.log(`Saved screenshot to: ${filePath}`);
  }

  console.log('All screenshots captured successfully!');
  app.exit(0);
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
