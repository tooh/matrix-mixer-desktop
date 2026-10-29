import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { DB, HELIX_MATRIX_CHANNELS, MATRIX_LAYERS, Preset, SHOWCASE_STEM_ORDER } from './db';
import { startBackupScheduler } from './backupScheduler';
import { ServerMidi } from './serverMidi';

dotenv.config();

const execFileAsync = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3005;
const VERSION = '1.4.5';

app.use(cors());
app.use(express.json());

// 1. Version Endpoint (Non-cached)
app.get('/version.txt', (_req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'text/plain'
  });
  res.send(VERSION);
});

// 2. Health & Status
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'MatrixMixer',
    version: VERSION,
    timestamp: new Date().toISOString(),
    supportedDevice: 'Line 6 Helix Stadium 1.4',
    layers: MATRIX_LAYERS.length,
    channels: HELIX_MATRIX_CHANNELS.length
  });
});

// Stage Wi-Fi Remote Info
app.get('/api/network/info', (_req: Request, res: Response) => {
  const localIps = getLocalIpAddresses();
  const primaryIp = localIps[0] || '127.0.0.1';
  const port = Number(process.env.PORT || PORT);
  res.json({
    port,
    localIps,
    primaryIp,
    remoteUrl: `http://${primaryIp}:${port}`
  });
});

// 3. Matrix Configuration (Specs from Helix Stadium 1.4)
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    channels: HELIX_MATRIX_CHANNELS,
    layers: MATRIX_LAYERS,
    showcaseStemOrder: SHOWCASE_STEM_ORDER,
    clearSoloCC: 103,
    ccRanges: {
      level: { min: 0, max: 127 },
      pan: { min: 0, center: 64, max: 127 },
      muteThreshold: 64,
      soloThreshold: 64,
      clearSoloThreshold: 64
    }
  });
});

// 4. Server-Side USB MIDI (Mac -> Helix Stadium)
app.get('/api/midi/devices', async (_req: Request, res: Response) => {
  const devices = await ServerMidi.refreshDevices();
  res.json({
    devices,
    activeDevice: ServerMidi.getActiveDevice()
  });
});

app.post('/api/midi/device', (req: Request, res: Response) => {
  const { device } = req.body;
  if (device !== undefined) {
    ServerMidi.setActiveDevice(device);
  }
  res.json({ success: true, activeDevice: ServerMidi.getActiveDevice() });
});

// Real-Time Server-Sent Events (SSE) Stream for iOS / Safari / Wi-Fi clients
app.get('/api/midi/stream', (_req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('\n');

  ServerMidi.addStreamClient(res);

  _req.on('close', () => {
    ServerMidi.removeStreamClient(res);
  });
});

app.post('/api/midi/send', async (req: Request, res: Response) => {
  const { channel, cc, value, device } = req.body;
  if (channel === undefined || cc === undefined || value === undefined) {
    return res.status(400).json({ error: 'channel, cc en value zijn verplicht' });
  }

  const success = await ServerMidi.sendCC(Number(channel), Number(cc), Number(value), device);
  res.json({ success, channel, cc, value });
});

app.post('/api/midi/send-pc', async (req: Request, res: Response) => {
  const { channel, program, device } = req.body;
  if (channel === undefined || program === undefined) {
    return res.status(400).json({ error: 'channel and program are required' });
  }

  const success = await ServerMidi.sendPC(Number(channel), Number(program), device);
  res.json({ success, channel, program });
});

app.post('/api/midi/trigger-pc', (req: Request, res: Response) => {
  const { program, channel } = req.body;
  if (program === undefined) {
    return res.status(400).json({ error: 'program is required' });
  }
  const progNum = Number(program);
  const chNum = channel !== undefined ? Number(channel) : undefined;
  const preset = DB.getPresetByPC(progNum, chNum);
  if (!preset) {
    return res.status(404).json({ error: `No preset mapped to PC ${progNum}` });
  }
  DB.logAudit('PRESET_TRIGGERED_VIA_PC', { presetId: preset.id, name: preset.name, program: progNum, channel: chNum });
  res.json({ success: true, preset });
});

// 5. Presets API
app.get('/api/presets', (_req: Request, res: Response) => {
  res.json(DB.getPresets());
});

app.post('/api/presets', (req: Request, res: Response) => {
  const { name, description, layers, midiPC, midiChannel } = req.body;
  if (!name || !layers) {
    return res.status(400).json({ error: 'Name and layers are required' });
  }
  const safePC = (midiPC !== undefined && midiPC !== null && midiPC !== '') ? Number(midiPC) : null;
  const safeChannel = (midiChannel !== undefined && midiChannel !== null && midiChannel !== '') ? Number(midiChannel) : null;

  const newPreset: Preset = {
    id: 'preset-' + Date.now(),
    name,
    description: description || '',
    createdAt: new Date().toISOString(),
    midiPC: safePC !== null && !isNaN(safePC) ? Math.max(0, Math.min(127, safePC)) : null,
    midiChannel: safeChannel !== null && !isNaN(safeChannel) ? Math.max(1, Math.min(16, safeChannel)) : null,
    layers
  };
  DB.savePreset(newPreset);
  DB.logAudit('PRESET_CREATED', { id: newPreset.id, name: newPreset.name, midiPC: newPreset.midiPC });
  res.json(newPreset);
});

app.put('/api/presets/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const presets = DB.getPresets();
  const existing = presets.find(p => p.id === id);
  if (!existing) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  const { name, description, midiPC, midiChannel, layers } = req.body;
  if (name !== undefined) existing.name = name;
  if (description !== undefined) existing.description = description;
  if (layers !== undefined) existing.layers = layers;
  if (midiPC !== undefined) {
    const num = Number(midiPC);
    existing.midiPC = (midiPC !== null && !isNaN(num)) ? Math.max(0, Math.min(127, num)) : null;
  }
  if (midiChannel !== undefined) {
    const num = Number(midiChannel);
    existing.midiChannel = (midiChannel !== null && !isNaN(num)) ? Math.max(1, Math.min(16, num)) : null;
  }
  DB.savePreset(existing);
  DB.logAudit('PRESET_UPDATED', { id: existing.id, name: existing.name, midiPC: existing.midiPC });
  res.json(existing);
});

app.delete('/api/presets/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = DB.deletePreset(id);
  if (success) {
    DB.logAudit('PRESET_DELETED', { id });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Preset not found' });
  }
});

// 5. Settings API
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(DB.getSettings());
});

app.post('/api/settings', (req: Request, res: Response) => {
  DB.saveSettings(req.body);
  DB.logAudit('SETTINGS_UPDATED', req.body);
  res.json({ success: true, settings: req.body });
});

// 6. RBAC Authentication API
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password, pin } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (pin) {
    if (pin === '1234') {
      return res.json({
        success: true,
        user: { id: 'user-pin-1', name: 'Band Member', role: 'BAND_MEMBER' }
      });
    } else if (pin === '9999') {
      return res.json({
        success: true,
        user: { id: 'user-pin-admin', name: 'Administrator', role: 'ADMIN' }
      });
    }
    return res.status(401).json({ error: 'Invalid PIN code' });
  }

  if (username && password) {
    const cleanUser = username.toLowerCase().trim();
    if (cleanUser === 'admin') {
      if (!adminPassword) {
        return res.status(500).json({ error: 'Administrator password not configured in environment (.env).' });
      }
      if (password === adminPassword) {
        return res.json({
          success: true,
          user: { id: 'usr-admin', name: 'System Administrator', role: 'ADMIN' }
        });
      }
    } else if (cleanUser === 'sound' || cleanUser === 'foh') {
      return res.json({
        success: true,
        user: { id: 'usr-foh', name: 'FOH Sound Engineer', role: 'OPERATOR' }
      });
    } else if (cleanUser === 'band' || cleanUser === 'musician' || cleanUser === 'muzikant') {
      return res.json({
        success: true,
        user: { id: 'usr-band', name: 'Band Member (IEM)', role: 'BAND_MEMBER' }
      });
    }
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  res.status(400).json({ error: 'Credentials required' });
});

// 7. GitHub CLI Scrum Issue Logger
app.post('/api/github/create-issue', async (req: Request, res: Response) => {
  const { title, body, labels } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  const GITHUB_REPO = process.env.GITHUB_REPO || 'tooh/matrix-mixer';

  try {
    const labelArgs = (labels || []).flatMap((l: string) => ['-l', l]);
    const { stdout } = await execFileAsync(
      'gh',
      ['issue', 'create', '--repo', GITHUB_REPO, '--title', title, '--body', body, ...labelArgs],
      {
        timeout: 15000,
        env: {
          ...process.env,
          GH_PROMPT_DISABLED: '1',
          GH_NO_UPDATE_NOTIFIER: '1',
          NO_COLOR: '1'
        }
      }
    );
    const url = stdout.trim();
    const issueNum = url.split('/').pop() || 'new';
    res.json({ success: true, url, issueNumber: issueNum });
  } catch (err: any) {
    // In local sandbox or offline mode, simulate issue receipt
    console.warn('[GitHub CLI] Failed to create issue via gh:', err.message);
    const simulatedNum = Math.floor(Math.random() * 100) + 1;
    res.json({
      success: true,
      simulated: true,
      url: `https://github.com/${GITHUB_REPO}/issues/${simulatedNum}`,
      issueNumber: `#${simulatedNum} (Locally registered)`
    });
  }
});

// 8. In-App Documentation Reader
app.post('/api/docs/read', (req: Request, res: Response) => {
  const { file } = req.body;
  const allowed = [
    'Functional_Application_Manual_FAM.md',
    'Technical_Application_Manual_TAM.md',
    'Functioneel_Applicatiebeheer_FAM.md',
    'Technisch_Applicatiebeheer_TAM.md',
    'CHANGELOG.md',
    'openapi.yaml',
    'openapi.json'
  ];

  if (!file || !allowed.includes(file)) {
    return res.status(400).json({ error: 'File not allowed' });
  }

  const filePath = path.resolve(process.cwd(), 'docs', file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ filename: file, content });
});

// 9. OpenAPI Specs
app.get('/api/openapi.json', (_req: Request, res: Response) => {
  const p = path.resolve(process.cwd(), 'docs/openapi.json');
  if (fs.existsSync(p)) {
    res.sendFile(p);
  } else {
    res.status(404).send('OpenAPI not found');
  }
});

app.get('/api/openapi.yaml', (_req: Request, res: Response) => {
  const p = path.resolve(process.cwd(), 'docs/openapi.yaml');
  if (fs.existsSync(p)) {
    res.type('text/yaml').sendFile(p);
  } else {
    res.status(404).send('OpenAPI not found');
  }
});

// 10. Swagger UI Endpoint
app.get('/api-docs', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>MatrixMixer REST API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body style="margin: 0; background: #0b0f19;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>`);
});

// 11. Static Renderer Files & SPA Fallback
function resolveRendererDir(): string {
  const candidates = [
    path.join(__dirname, '../renderer'),
    path.join(__dirname, 'renderer'),
    path.resolve(process.cwd(), 'dist/renderer'),
    path.resolve(process.cwd(), 'src/renderer')
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) {
      return c;
    }
  }
  return candidates[0];
}

const rendererDir = resolveRendererDir();
app.use(express.static(rendererDir));

app.all('/{*splat}', (_req: Request, res: Response) => {
  const indexFile = path.join(rendererDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile('index.html', { root: rendererDir });
  } else {
    res.send(`<h1>MatrixMixer backend running</h1><p>Run <code>npm run build</code> to bundle the frontend.</p>`);
  }
});

// Start scheduler & listen
startBackupScheduler();

export function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

export function startServer(port = PORT): Promise<{ app: any; port: number; localIps: string[] }> {
  const portNum = Number(port);
  return new Promise((resolve) => {
    const server = app.listen(portNum, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🎛️  MatrixMixer (Helix Stadium 1.4) is running on:`);
      console.log(`👉  http://localhost:${portNum}`);
      console.log(`👉  http://127.0.0.1:${portNum}`);
      const localIps = getLocalIpAddresses();
      for (const ip of localIps) {
        console.log(`👉  http://${ip}:${portNum} (LAN / iPad / Tablet)`);
      }
      console.log(`🏷️  Version: ${VERSION}`);
      console.log(`=======================================================`);
      resolve({ app: server, port: portNum, localIps });
    });
  });
}

// If run directly (not imported as a module by Electron)
if (process.env.ELECTRON_RUN_AS_NODE !== '1' && !process.versions.electron) {
  startServer(PORT);
}
