import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { Response } from 'express';

const execFileAsync = promisify(execFile);

function resolveSendMidiPath(): string {
  if (process.env.SENDMIDI_PATH && fs.existsSync(process.env.SENDMIDI_PATH)) {
    return process.env.SENDMIDI_PATH;
  }
  if (fs.existsSync('/opt/homebrew/bin/sendmidi')) {
    return '/opt/homebrew/bin/sendmidi';
  }
  if (fs.existsSync('/usr/local/bin/sendmidi')) {
    return '/usr/local/bin/sendmidi';
  }
  return 'sendmidi';
}

function resolveReceiveMidiPath(): string {
  if (process.env.RECEIVEMIDI_PATH && fs.existsSync(process.env.RECEIVEMIDI_PATH)) {
    return process.env.RECEIVEMIDI_PATH;
  }
  if (fs.existsSync('/opt/homebrew/bin/receivemidi')) {
    return '/opt/homebrew/bin/receivemidi';
  }
  if (fs.existsSync('/usr/local/bin/receivemidi')) {
    return '/usr/local/bin/receivemidi';
  }
  return 'receivemidi';
}

const SENDMIDI_PATH = resolveSendMidiPath();
const RECEIVEMIDI_PATH = resolveReceiveMidiPath();

class ServerMidiService {
  private activeDevice: string = '';
  private availableDevices: string[] = [];
  private ingressProcesses: Map<string, ChildProcess> = new Map();
  private sseClients: Set<Response> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private electronMidiOutHandler: ((data: { type: 'cc' | 'pc'; channel: number; cc?: number; program?: number; value?: number }) => void) | null = null;

  setElectronBridge(handler: (data: { type: 'cc' | 'pc'; channel: number; cc?: number; program?: number; value?: number }) => void) {
    this.electronMidiOutHandler = handler;
  }

  handleIncomingMidi(data: { type: 'cc' | 'pc'; channel: number; cc?: number; program?: number; value?: number; source?: string }) {
    this.broadcast({
      type: data.type,
      channel: data.channel,
      cc: data.cc,
      value: data.value,
      program: data.program,
      source: data.source || 'USB Web MIDI'
    });
  }

  constructor() {
    this.refreshDevices().then(() => {
      this.startIngress();
    });

    this.heartbeatTimer = setInterval(() => {
      this.broadcast({ type: 'heartbeat', timestamp: new Date().toISOString() });
    }, 20000);
  }

  async refreshDevices(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(SENDMIDI_PATH, ['list'], { timeout: 3000 });
      const list = stdout
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      this.availableDevices = list;

      // Auto-select Helix or Stadium if found
      if (!this.activeDevice || !list.includes(this.activeDevice)) {
        const helix = list.find(d => /helix|stadium/i.test(d));
        if (helix) {
          this.activeDevice = helix;
        } else if (list.length > 0) {
          this.activeDevice = list[0];
        }
      }

      return list;
    } catch (err: any) {
      console.warn('[ServerMidi] Failed to invoke sendmidi:', err.message);
      return [];
    }
  }

  getActiveDevice(): string {
    return this.activeDevice;
  }

  setActiveDevice(device: string) {
    this.activeDevice = device;
    this.startIngress();
  }

  getDevices(): string[] {
    return this.availableDevices;
  }

  // --- CoreMIDI Ingress Daemon (receivemidi -> SSE) ---

  startIngress() {
    this.stopIngress();

    // Determine target devices to monitor: active device + IAC Driver if available for testing
    const targets = new Set<string>();
    if (this.activeDevice) targets.add(this.activeDevice);
    
    const iac = this.availableDevices.find(d => /iac driver/i.test(d));
    if (iac) targets.add(iac);

    if (targets.size === 0) {
      targets.add('');
    }

    for (const dev of targets) {
      this.spawnReceiveProcess(dev);
    }
  }

  private spawnReceiveProcess(dev: string) {
    const args = dev ? ['dev', dev, 'dec', 'pc', 'cc'] : ['dec', 'pc', 'cc'];
    const devLabel = dev || 'Default MIDI Port';

    try {
      const proc = spawn(RECEIVEMIDI_PATH, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let buffer = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          this.parseIngressLine(line.trim(), devLabel);
        }
      });

      proc.stderr?.on('data', () => {});

      proc.on('exit', () => {
        this.ingressProcesses.delete(dev);
      });

      proc.on('error', (err) => {
        console.warn(`[ServerMidi Ingress] Could not listen to ${devLabel}:`, err.message);
      });

      this.ingressProcesses.set(dev, proc);
      console.log(`[ServerMidi Ingress] Monitoring ${devLabel} via ${RECEIVEMIDI_PATH}`);
    } catch (e: any) {
      console.warn(`[ServerMidi Ingress] Error spawning listener for ${devLabel}:`, e.message);
    }
  }

  private parseIngressLine(line: string, sourceDev: string) {
    if (!line) return;

    // 1. Program Change: "channel  1   program-change         0"
    const pcMatch = line.match(/channel\s+(\d+)\s+program-change\s+(\d+)/i);
    if (pcMatch) {
      const channel = parseInt(pcMatch[1], 10);
      const program = parseInt(pcMatch[2], 10);
      console.log(`[ServerMidi Ingress] Recv PC ${program} on Ch ${channel} (from ${sourceDev})`);
      this.broadcast({
        type: 'pc',
        channel,
        program,
        source: sourceDev,
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    // 2. Control Change: "channel  3   control-change    11    95"
    const ccMatch = line.match(/channel\s+(\d+)\s+control-change\s+(\d+)\s+(\d+)/i);
    if (ccMatch) {
      const channel = parseInt(ccMatch[1], 10);
      const cc = parseInt(ccMatch[2], 10);
      const value = parseInt(ccMatch[3], 10);
      this.broadcast({
        type: 'cc',
        channel,
        cc,
        value,
        source: sourceDev,
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }
  }

  stopIngress() {
    for (const [dev, proc] of this.ingressProcesses.entries()) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {}
    }
    this.ingressProcesses.clear();
  }

  // --- Server-Sent Events (SSE) Client Stream ---

  addStreamClient(res: Response) {
    this.sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'connected', activeDevice: this.activeDevice })}\n\n`);
  }

  removeStreamClient(res: Response) {
    this.sseClients.delete(res);
  }

  broadcast(payload: any) {
    if (this.sseClients.size === 0) return;
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(msg);
      } catch (e) {
        this.sseClients.delete(client);
      }
    }
  }

  // --- Egress Sending ---

  async sendCC(channel: number, cc: number, value: number, targetDevice?: string): Promise<boolean> {
    const dev = targetDevice || this.activeDevice;
    const safeCh = Math.max(1, Math.min(16, channel));
    const safeCC = Math.max(0, Math.min(127, cc));
    const safeVal = Math.max(0, Math.min(127, value));

    // 1. Broadcast to all other connected web/tablet clients via SSE
    this.broadcast({ type: 'cc', channel: safeCh, cc: safeCC, value: safeVal, source: 'Remote Relay' });

    // 2. If Electron bridge is registered, send via native Web MIDI to USB Helix
    if (this.electronMidiOutHandler) {
      try {
        this.electronMidiOutHandler({ type: 'cc', channel: safeCh, cc: safeCC, value: safeVal });
        return true;
      } catch (err) {
        console.warn('[ServerMidi] Electron bridge error:', err);
      }
    }

    // 3. Fallback to CLI sendmidi if available
    const args = dev
      ? ['dev', dev, 'ch', safeCh.toString(), 'cc', safeCC.toString(), safeVal.toString()]
      : ['ch', safeCh.toString(), 'cc', safeCC.toString(), safeVal.toString()];

    try {
      await execFileAsync(SENDMIDI_PATH, args, { timeout: 2000 });
      return true;
    } catch (err: any) {
      // If sendmidi is not found on Windows or non-Homebrew systems, this is expected
      return true;
    }
  }

  async sendPC(channel: number, program: number, targetDevice?: string): Promise<boolean> {
    const dev = targetDevice || this.activeDevice;
    const safeCh = Math.max(1, Math.min(16, channel));
    const safeProg = Math.max(0, Math.min(127, program));

    // 1. Broadcast to all other connected web/tablet clients via SSE
    this.broadcast({ type: 'pc', channel: safeCh, program: safeProg, source: 'Remote Relay' });

    // 2. If Electron bridge is registered, send via native Web MIDI to USB Helix
    if (this.electronMidiOutHandler) {
      try {
        this.electronMidiOutHandler({ type: 'pc', channel: safeCh, program: safeProg });
        return true;
      } catch (err) {
        console.warn('[ServerMidi] Electron bridge error:', err);
      }
    }

    // 3. Fallback to CLI sendmidi if available
    const args = dev
      ? ['dev', dev, 'ch', safeCh.toString(), 'pc', safeProg.toString()]
      : ['ch', safeCh.toString(), 'pc', safeProg.toString()];

    try {
      await execFileAsync(SENDMIDI_PATH, args, { timeout: 2000 });
      return true;
    } catch (err: any) {
      return true;
    }
  }
}

export const ServerMidi = new ServerMidiService();
