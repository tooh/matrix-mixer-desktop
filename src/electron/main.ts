import { app, BrowserWindow, ipcMain, session, shell, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';

process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[Electron] Unhandled Rejection:', err);
});

// Configure persistent database directory in user data path
try {
  const userDataPath = app.getPath('userData');
  const databaseDir = path.join(userDataPath, 'database');
  process.env.APP_DATA_DIR = databaseDir;

  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Electron] Could not setup userData directory:', e);
}

import { startServer, getLocalIpAddresses } from '../main/main';
import { ServerMidi } from '../main/serverMidi';

let mainWindow: BrowserWindow | null = null;
let serverPort = 3005;

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: '🐞 Scrum Melding Vastleggen...',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('open-scrum-modal');
          }
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'Bestand',
      submenu: [
        {
          label: '💾 Scènes & Presets...',
          accelerator: 'CommandOrControl+P',
          click: () => {
            mainWindow?.webContents.send('open-presets-modal');
          }
        },
        {
          label: '🎛️ MIDI Apparaat & Kanalen...',
          accelerator: 'CommandOrControl+M',
          click: () => {
            mainWindow?.webContents.send('open-midi-modal');
          }
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Bewerken',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    // Dedicated Scrum Menu in top menubar
    {
      label: 'Scrum',
      submenu: [
        {
          label: '🐞 Nieuwe Scrum Melding Vastleggen...',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('open-scrum-modal');
          }
        },
        { type: 'separator' as const },
        {
          label: '🌐 Bekijk GitHub Backlog Issues...',
          click: () => {
            shell.openExternal('https://github.com/tooh/matrix-mixer-desktop/issues');
          }
        }
      ]
    },
    {
      label: 'Weergave',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Venster',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    {
      role: 'help' as const,
      submenu: [
        {
          label: '🐞 Scrum Melding Vastleggen...',
          accelerator: 'CommandOrControl+Shift+B',
          click: () => {
            mainWindow?.webContents.send('open-scrum-modal');
          }
        },
        {
          label: '📖 Handboeken & Documentatie (FAM/TAM)...',
          accelerator: 'CommandOrControl+D',
          click: () => {
            mainWindow?.webContents.send('open-docs-modal');
          }
        },
        {
          label: '📱 Stage Wi-Fi Remote Info & QR...',
          click: () => {
            mainWindow?.webContents.send('open-wifi-modal');
          }
        },
        { type: 'separator' as const },
        {
          label: '🚀 Controleer op Updates...',
          click: () => {
            mainWindow?.webContents.send('check-for-updates');
          }
        },
        {
          label: '🌐 GitHub Repository...',
          click: () => {
            shell.openExternal('https://github.com/tooh/matrix-mixer-desktop');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  // 1. Start embedded Express server for Wi-Fi clients (iPads / smartphones)
  try {
    const srv = await startServer(serverPort);
    serverPort = srv.port;
  } catch (err) {
    console.warn('[Electron] Server start warning (might already be running):', err);
  }

  // 2. Set up Electron MIDI Bridge:
  // When remote Wi-Fi clients (iPads) send MIDI to the server, forward to Electron's Web MIDI engine
  ServerMidi.setElectronBridge((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (data.type === 'cc') {
        mainWindow.webContents.send('midi-out-request', data);
      } else if (data.type === 'pc') {
        mainWindow.webContents.send('pc-out-request', data);
      }
    }
  });

  // 3. Configure Web MIDI permissions in Chromium so Line 6 Helix USB is auto-permitted
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'midi' || permission === 'midiSysex') return true;
    return false;
  });

  session.defaultSession.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'midi') return true;
    return false;
  });

  // 4. Create Main App Window
  const iconPath = path.join(__dirname, '../renderer/icon.png');
  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath);
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    fullscreen: true,
    fullscreenable: true,
    title: 'Helix Stadium 1.4 - Matrix Mixer',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f172a',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  setupApplicationMenu();

  mainWindow.maximize();
  mainWindow.setFullScreen(true);

  // Ensure freshest UI is always loaded in desktop Electron
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
  } catch (e) {}

  // Load local mixer UI
  const targetUrl = `http://localhost:${serverPort}`;
  console.log(`[Electron] Loading UI at ${targetUrl}`);
  mainWindow.loadURL(targetUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Renderer asks for Wi-Fi remote information to show in the UI / QR code
ipcMain.handle('get-network-info', () => {
  const localIps = getLocalIpAddresses();
  const primaryIp = localIps[0] || '127.0.0.1';
  return {
    port: serverPort,
    localIps,
    primaryIp,
    remoteUrl: `http://${primaryIp}:${serverPort}`
  };
});

// IPC: Open external link in system default browser (e.g. GitHub Releases)
ipcMain.handle('open-external', (_event, targetUrl: string) => {
  if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
    shell.openExternal(targetUrl);
    return true;
  }
  return false;
});

// IPC: When Electron's Web MIDI receives incoming MIDI from the physical USB Helix,
// relay it to the server so all Wi-Fi clients stay in sync
ipcMain.on('midi-ingress-received', (_event, data) => {
  ServerMidi.handleIncomingMidi({
    type: data.type,
    channel: data.channel,
    cc: data.cc,
    value: data.value,
    program: data.program,
    source: 'USB Web MIDI'
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
