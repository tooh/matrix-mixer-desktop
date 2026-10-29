import { MidiPortInfo, MidiMessageEvent, PcListener } from './types';

type MidiListener = (channel: number, cc: number, value: number) => void;
type LogListener = (event: MidiMessageEvent) => void;

class MidiService {
  private midiAccess: any = null;
  private selectedInputId: string = 'all';
  private selectedOutputId: string = '';
  private listeners: Set<MidiListener> = new Set();
  private pcListeners: Set<PcListener> = new Set();
  private logListeners: Set<LogListener> = new Set();
  private messageHistory: MidiMessageEvent[] = [];
  private eventSource: EventSource | null = null;
  private lastProcessedHash: string = '';
  private lastProcessedTime: number = 0;
  public isSupported: boolean = false;
  public isConnected: boolean = false;
  public isServerRelayActive: boolean = false;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  async init(): Promise<boolean> {
    // 1. Always connect to Mac CoreMIDI Server Relay (essential for iOS Safari, iPad, and Wi-Fi devices)
    this.initServerRelay();

    // 2. Connect to local Web MIDI if browser supports it
    if (!this.isSupported) {
      this.log('out', 0, 0, 0, 'Web MIDI API not supported by this browser. CoreMIDI Server Relay is active.');
      return false;
    }

    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.isConnected = true;
      this.setupPorts();

      this.midiAccess.onstatechange = () => {
        this.setupPorts();
      };

      // 3. Connect to Electron IPC if running as Desktop app
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const electron = (window as any).electronAPI;
        electron.onMidiOutRequest((data: { channel: number; cc: number; value: number }) => {
          this.sendDirectCC(data.channel, data.cc, data.value);
        });
        electron.onPcOutRequest((data: { channel: number; program: number }) => {
          this.sendDirectPC(data.channel, data.program);
        });
      }

      this.log('out', 0, 0, 0, 'Web MIDI API connected successfully.');
      return true;
    } catch (err: any) {
      console.warn('Web MIDI access denied or failed:', err);
      this.log('out', 0, 0, 0, `Web MIDI error: ${err.message}. CoreMIDI Server Relay is active.`);
      return false;
    }
  }

  initServerRelay() {
    if (typeof window === 'undefined' || !(window as any).EventSource) return;
    if (this.eventSource) return;

    try {
      this.eventSource = new EventSource('/api/midi/stream');

      this.eventSource.onopen = () => {
        this.isServerRelayActive = true;
        this.log('out', 0, 0, 0, 'CoreMIDI Server Relay stream connected (Bidirectional Ingress & Egress).');
      };

      this.eventSource.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'pc') {
            if (this.isDuplicate('pc', msg.channel, msg.program, 0)) return;
            const srcInfo = msg.source ? ` (${msg.source})` : '';
            this.log('in', msg.channel, 0, msg.program, `Received Program Change PC ${msg.program} (Ch ${msg.channel}) [Server Relay${srcInfo}]`);
            this.pcListeners.forEach(fn => fn(msg.channel, msg.program));
          } else if (msg.type === 'cc') {
            if (this.isDuplicate('cc', msg.channel, msg.cc, msg.value)) return;
            const srcInfo = msg.source ? ` (${msg.source})` : '';
            this.log('in', msg.channel, msg.cc, msg.value, `Received CC${msg.cc} = ${msg.value} (Ch ${msg.channel}) [Server Relay${srcInfo}]`);
            this.listeners.forEach(fn => fn(msg.channel, msg.cc, msg.value));
          }
        } catch (err) {}
      };

      this.eventSource.onerror = () => {
        this.isServerRelayActive = false;
      };
    } catch (err) {
      console.warn('Failed to start Server MIDI EventSource:', err);
    }
  }

  private isDuplicate(type: string, channel: number, num: number, val: number): boolean {
    const hash = `${type}_${channel}_${num}_${val}`;
    const now = Date.now();
    if (this.lastProcessedHash === hash && (now - this.lastProcessedTime) < 800) {
      return true;
    }
    this.lastProcessedHash = hash;
    this.lastProcessedTime = now;
    return false;
  }

  private setupPorts() {
    if (!this.midiAccess) return;

    const outputs = this.getOutputs();

    // Default to 'all' so every connected device is monitored without manual configuration
    if (!this.selectedInputId || this.selectedInputId === 'all') {
      this.selectInput('all');
    } else {
      this.selectInput(this.selectedInputId);
    }

    if (!this.selectedOutputId && outputs.length > 0) {
      const helixOut = outputs.find(o => o.name.toLowerCase().includes('helix') || o.name.toLowerCase().includes('stadium'));
      this.selectOutput(helixOut ? helixOut.id : outputs[0].id);
    }
  }

  getInputs(): MidiPortInfo[] {
    if (!this.midiAccess) return [];
    const ports: MidiPortInfo[] = [];
    this.midiAccess.inputs.forEach((port: any) => {
      ports.push({
        id: port.id,
        name: port.name || 'MIDI In',
        manufacturer: port.manufacturer || '',
        state: port.state
      });
    });
    return ports;
  }

  getOutputs(): MidiPortInfo[] {
    if (!this.midiAccess) return [];
    const ports: MidiPortInfo[] = [];
    this.midiAccess.outputs.forEach((port: any) => {
      ports.push({
        id: port.id,
        name: port.name || 'MIDI Out',
        manufacturer: port.manufacturer || '',
        state: port.state
      });
    });
    return ports;
  }

  selectInput(portId: string) {
    if (!this.midiAccess) return;

    // Detach previous
    this.midiAccess.inputs.forEach((port: any) => {
      port.onmidimessage = null;
    });

    this.selectedInputId = portId;

    if (portId === 'all') {
      let count = 0;
      this.midiAccess.inputs.forEach((port: any) => {
        port.onmidimessage = (event: any) => this.handleIncomingMessage(event);
        count++;
      });
      this.log('in', 0, 0, 0, `MIDI Ingress attached to: All Connected Inputs (${count} ports active)`);
    } else {
      const port = this.midiAccess.inputs.get(portId);
      if (port) {
        port.onmidimessage = (event: any) => this.handleIncomingMessage(event);
        this.log('in', 0, 0, 0, `MIDI Ingress attached to: ${port.name}`);
      }
    }
  }

  selectOutput(portId: string) {
    this.selectedOutputId = portId;
    if (this.midiAccess) {
      const port = this.midiAccess.outputs.get(portId);
      if (port) {
        this.log('out', 0, 0, 0, `MIDI Egress attached to: ${port.name}`);
      }
    }
  }

  getSelectedInputId(): string {
    return this.selectedInputId;
  }

  getSelectedOutputId(): string {
    return this.selectedOutputId;
  }

  private handleIncomingMessage(event: any) {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0];
    const messageType = status & 0xF0;
    const channel = (status & 0x0F) + 1; // 1-16

    if (messageType === 0xB0 && data.length >= 3) { // Control Change
      const cc = data[1];
      const value = data[2];
      if (this.isDuplicate('cc', channel, cc, value)) return;
      this.log('in', channel, cc, value, `Received CC${cc} = ${value} (Ch ${channel}) [Web MIDI]`);
      this.listeners.forEach(fn => fn(channel, cc, value));

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        (window as any).electronAPI.sendMidiIngress({ type: 'cc', channel, cc, value });
      }
    } else if (messageType === 0xC0) { // Program Change (2 bytes)
      const program = data[1];
      if (this.isDuplicate('pc', channel, program, 0)) return;
      this.log('in', channel, 0, program, `Received Program Change PC ${program} (Ch ${channel}) [Web MIDI]`);
      this.pcListeners.forEach(fn => fn(channel, program));

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        (window as any).electronAPI.sendMidiIngress({ type: 'pc', channel, program });
      }
    }
  }

  sendDirectCC(channel: number, cc: number, value: number) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;
    const safeChannel = Math.max(1, Math.min(16, channel));
    const safeCC = Math.max(0, Math.min(127, cc));
    const safeValue = Math.max(0, Math.min(127, value));
    const statusByte = 0xB0 | (safeChannel - 1);
    try {
      output.send([statusByte, safeCC, safeValue]);
      this.log('out', safeChannel, safeCC, safeValue, `Remote Wi-Fi -> USB Helix CC${safeCC} = ${safeValue} (Ch ${safeChannel})`);
    } catch (e) {
      console.warn('Direct MIDI output error:', e);
    }
  }

  sendDirectPC(channel: number, program: number) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;
    const safeChannel = Math.max(1, Math.min(16, channel));
    const safeProg = Math.max(0, Math.min(127, program));
    const statusByte = 0xC0 | (safeChannel - 1);
    try {
      output.send([statusByte, safeProg]);
      this.log('out', safeChannel, 0, safeProg, `Remote Wi-Fi -> USB Helix PC${safeProg} (Ch ${safeChannel})`);
    } catch (e) {
      console.warn('Direct PC output error:', e);
    }
  }

  sendCC(channel: number, cc: number, value: number, description?: string) {
    const safeChannel = Math.max(1, Math.min(16, channel));
    const safeCC = Math.max(0, Math.min(127, cc));
    const safeValue = Math.max(0, Math.min(127, value));

    const statusByte = 0xB0 | (safeChannel - 1);
    const bytes = [statusByte, safeCC, safeValue];

    let sent = false;
    if (this.midiAccess && this.selectedOutputId) {
      const output = this.midiAccess.outputs.get(this.selectedOutputId);
      if (output) {
        try {
          output.send(bytes);
          sent = true;
        } catch (e) {
          console.warn('Fout bij versturen van MIDI:', e);
        }
      }
    }

    const desc = description || `Sent CC${safeCC} = ${safeValue} (Ch ${safeChannel}) ${sent ? '[Web MIDI]' : '[Server Relay]'}`;
    this.log('out', safeChannel, safeCC, safeValue, desc);

    // Relay to backend server on Mac (so iPhone / iPad without Web MIDI control the Helix via USB!)
    this.relayToServer(safeChannel, safeCC, safeValue);
  }

  sendPC(channel: number, program: number, description?: string) {
    const safeChannel = Math.max(1, Math.min(16, channel));
    const safeProg = Math.max(0, Math.min(127, program));

    const statusByte = 0xC0 | (safeChannel - 1);
    const bytes = [statusByte, safeProg];

    let sent = false;
    if (this.midiAccess && this.selectedOutputId) {
      const output = this.midiAccess.outputs.get(this.selectedOutputId);
      if (output) {
        try {
          output.send(bytes);
          sent = true;
        } catch (e) {
          console.warn('Error sending MIDI PC:', e);
        }
      }
    }

    const desc = description || `Sent PC ${safeProg} (Ch ${safeChannel}) ${sent ? '[Web MIDI]' : '[Server Relay]'}`;
    this.log('out', safeChannel, 0, safeProg, desc);

    // Relay to server
    fetch('/api/midi/send-pc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: safeChannel, program: safeProg })
    }).catch(() => {});
  }

  private pendingRelays: Map<string, { channel: number; cc: number; value: number }> = new Map();
  private relayTimer: any = null;

  private relayToServer(channel: number, cc: number, value: number) {
    const key = `${channel}_${cc}`;
    this.pendingRelays.set(key, { channel, cc, value });

    if (!this.relayTimer) {
      this.relayTimer = setTimeout(() => {
        this.flushRelays();
      }, 20); // 20ms throttle (50 updates/sec maximum, perfectly smooth and low latency)
    }
  }

  private flushRelays() {
    this.relayTimer = null;
    const items = Array.from(this.pendingRelays.values());
    this.pendingRelays.clear();

    for (const item of items) {
      fetch('/api/midi/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        keepalive: true
      }).catch(err => {
        // Ignore network errors in background
      });
    }
  }

  addListener(fn: MidiListener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  addPcListener(fn: PcListener) {
    this.pcListeners.add(fn);
    return () => this.pcListeners.delete(fn);
  }

  removePcListener(fn: PcListener) {
    this.pcListeners.delete(fn);
  }

  addLogListener(fn: LogListener) {
    this.logListeners.add(fn);
    return () => this.logListeners.delete(fn);
  }

  getLogs(): MidiMessageEvent[] {
    return [...this.messageHistory];
  }

  clearLogs() {
    this.messageHistory = [];
    this.logListeners.forEach(fn => fn({
      timestamp: new Date().toLocaleTimeString(),
      direction: 'in',
      channel: 0,
      cc: 0,
      value: 0,
      description: 'Log history cleared.'
    }));
  }

  private log(direction: 'in' | 'out', channel: number, cc: number, value: number, description: string) {
    const now = new Date();
    const timeBase = now.toLocaleTimeString([], { hour12: false });
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const ev: MidiMessageEvent = {
      timestamp: `${timeBase}.${ms}`,
      direction,
      channel,
      cc,
      value,
      description
    };
    this.messageHistory.unshift(ev);
    if (this.messageHistory.length > 500) this.messageHistory.pop();
    this.logListeners.forEach(fn => fn(ev));
  }
}

export const MIDI = new MidiService();
