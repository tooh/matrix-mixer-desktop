import fs from 'fs';
import path from 'path';

export interface ChannelDefinition {
  id: string;
  name: string;
  category: 'master' | 'path' | 'song' | 'track' | 'utility' | 'input';
  levelCC: number;
  panCC: number;
  muteCC: number;
  soloCC: number;
  defaultLevel: number; // 0-127
  defaultPan: number;   // 0-127 (64 = center)
  isUnused?: boolean;
}

export const HELIX_MATRIX_CHANNELS: ChannelDefinition[] = [
  { id: 'home', name: 'Home (All Paths)', category: 'master', levelCC: 11, panCC: 34, muteCC: 57, soloCC: 80, defaultLevel: 100, defaultPan: 64 },
  { id: 'path_1a', name: 'Path 1A', category: 'path', levelCC: 12, panCC: 35, muteCC: 58, soloCC: 81, defaultLevel: 100, defaultPan: 64 },
  { id: 'path_1b', name: 'Path 1B', category: 'path', levelCC: 13, panCC: 36, muteCC: 59, soloCC: 82, defaultLevel: 100, defaultPan: 64 },
  { id: 'path_1c', name: 'Path 1C', category: 'path', levelCC: 14, panCC: 37, muteCC: 60, soloCC: 83, defaultLevel: 100, defaultPan: 64 },
  { id: 'path_1d', name: 'Path 1D', category: 'path', levelCC: 15, panCC: 38, muteCC: 61, soloCC: 84, defaultLevel: 100, defaultPan: 64 },
  { id: 'song', name: 'Song (All Tracks)', category: 'song', levelCC: 16, panCC: 39, muteCC: 62, soloCC: 85, defaultLevel: 100, defaultPan: 64 },
  { id: 'track_1', name: 'Track 1 (Drums)', category: 'track', levelCC: 17, panCC: 40, muteCC: 63, soloCC: 86, defaultLevel: 95, defaultPan: 64 },
  { id: 'track_2', name: 'Track 2 (Bass)', category: 'track', levelCC: 18, panCC: 41, muteCC: 64, soloCC: 87, defaultLevel: 95, defaultPan: 64 },
  { id: 'track_3', name: 'Track 3 (Piano)', category: 'track', levelCC: 19, panCC: 42, muteCC: 65, soloCC: 88, defaultLevel: 90, defaultPan: 64 },
  { id: 'track_4', name: 'Track 4 (Guitar)', category: 'track', levelCC: 20, panCC: 43, muteCC: 66, soloCC: 89, defaultLevel: 90, defaultPan: 64 },
  { id: 'track_5', name: 'Track 5 (Other)', category: 'track', levelCC: 21, panCC: 44, muteCC: 67, soloCC: 90, defaultLevel: 85, defaultPan: 64 },
  { id: 'track_6', name: 'Track 6 (Vocals)', category: 'track', levelCC: 22, panCC: 45, muteCC: 68, soloCC: 91, defaultLevel: 105, defaultPan: 64 },
  { id: 'track_7', name: 'Track 7 (Click)', category: 'track', levelCC: 23, panCC: 46, muteCC: 69, soloCC: 92, defaultLevel: 85, defaultPan: 64 },
  { id: 'track_8', name: 'Track 8 (Cue)', category: 'track', levelCC: 24, panCC: 47, muteCC: 70, soloCC: 93, defaultLevel: 80, defaultPan: 64 },
  { id: 'click', name: 'Click', category: 'utility', levelCC: 25, panCC: 48, muteCC: 71, soloCC: 94, defaultLevel: 100, defaultPan: 64 },
  { id: 'count_in', name: 'Count In', category: 'utility', levelCC: 26, panCC: 49, muteCC: 72, soloCC: 95, defaultLevel: 100, defaultPan: 64 },
  { id: 'usb_1_2', name: 'USB In 1/2', category: 'input', levelCC: 27, panCC: 50, muteCC: 73, soloCC: 96, defaultLevel: 100, defaultPan: 64 },
  { id: 'bluetooth', name: 'Bluetooth In', category: 'input', levelCC: 28, panCC: 51, muteCC: 74, soloCC: 97, defaultLevel: 90, defaultPan: 64 },
  { id: 'aux_in', name: 'Aux In', category: 'input', levelCC: 29, panCC: 52, muteCC: 75, soloCC: 98, defaultLevel: 90, defaultPan: 64 }
];

export const CLEAR_SOLO_CC = 103;

export interface LayerConfig {
  id: 'quarter_inch' | 'xlr' | 'phones';
  name: string;
  defaultMidiChannel: number; // 1-16
  color: string;
}

export const MATRIX_LAYERS: LayerConfig[] = [
  { id: 'quarter_inch', name: 'Matrix > 1/4" Out', defaultMidiChannel: 3, color: '#3b82f6' },
  { id: 'xlr', name: 'Matrix > XLR Out', defaultMidiChannel: 4, color: '#10b981' },
  { id: 'phones', name: 'Matrix > Phones Out', defaultMidiChannel: 5, color: '#f59e0b' }
];

export interface ChannelState {
  level: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  name?: string;
  isUnused?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  midiPC?: number | null;      // Optional MIDI Program Change trigger (0-127)
  midiChannel?: number | null; // Optional MIDI Channel trigger (1-16, or null for Omni/Any)
  layers: {
    quarter_inch: { midiChannel: number; channels: Record<string, ChannelState> };
    xlr: { midiChannel: number; channels: Record<string, ChannelState> };
    phones: { midiChannel: number; channels: Record<string, ChannelState> };
  };
}

const defaultDataDir = path.resolve(process.cwd(), 'database');
const dataDir = process.env.APP_DATA_DIR || defaultDataDir;

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const presetsFile = path.join(dataDir, 'presets.json');
  const defaultPresetsFile = path.join(defaultDataDir, 'presets.json');
  if (!fs.existsSync(presetsFile) && fs.existsSync(defaultPresetsFile)) {
    try {
      fs.copyFileSync(defaultPresetsFile, presetsFile);
    } catch (e) {
      console.warn('Could not copy initial presets.json:', e);
    }
  }
}

function readJson<T>(filename: string, defaultValue: T): T {
  ensureDir();
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (e) {
    return defaultValue;
  }
}

function writeJson<T>(filename: string, data: T) {
  ensureDir();
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function getDefaultChannelStates(): Record<string, ChannelState> {
  const states: Record<string, ChannelState> = {};
  for (const ch of HELIX_MATRIX_CHANNELS) {
    states[ch.id] = {
      level: ch.defaultLevel,
      pan: ch.defaultPan,
      mute: false,
      solo: false,
      name: ch.name,
      isUnused: false
    };
  }
  return states;
}

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'preset-default',
    name: 'Factory Default (Standard Mix)',
    description: 'Line 6 Helix Stadium 1.4 standard level balance and centered panning.',
    createdAt: new Date().toISOString(),
    midiPC: 1,
    midiChannel: null,
    layers: {
      quarter_inch: { midiChannel: 3, channels: getDefaultChannelStates() },
      xlr: { midiChannel: 4, channels: getDefaultChannelStates() },
      phones: { midiChannel: 5, channels: getDefaultChannelStates() }
    }
  },
  {
    id: 'preset-in-ear',
    name: 'In-Ear Monitor (Vocal & Band)',
    description: 'Optimized for in-ear monitors / Phones out with prominent vocals and audible click / count-in.',
    createdAt: new Date().toISOString(),
    midiPC: 2,
    midiChannel: null,
    layers: {
      quarter_inch: { midiChannel: 3, channels: getDefaultChannelStates() },
      xlr: { midiChannel: 4, channels: getDefaultChannelStates() },
      phones: {
        midiChannel: 5,
        channels: {
          ...getDefaultChannelStates(),
          track_6: { level: 120, pan: 64, mute: false, solo: false, name: 'Vocals (Lead/Band)' },
          click: { level: 110, pan: 64, mute: false, solo: false, name: 'Click (IEM)' },
          count_in: { level: 115, pan: 64, mute: false, solo: false, name: 'Count In' }
        }
      }
    }
  }
];

export const SHOWCASE_STEM_ORDER = [
  { id: 'track_1', stem: 'Drums', name: 'Track 1 (Drums)' },
  { id: 'track_2', stem: 'Bass', name: 'Track 2 (Bass)' },
  { id: 'track_3', stem: 'Piano', name: 'Track 3 (Piano)' },
  { id: 'track_4', stem: 'Guitar', name: 'Track 4 (Guitar)' },
  { id: 'track_5', stem: 'Other', name: 'Track 5 (Other)' },
  { id: 'track_6', stem: 'Vocals', name: 'Track 6 (Vocals)' },
  { id: 'track_7', stem: 'Click', name: 'Track 7 (Click)' },
  { id: 'track_8', stem: 'Cue', name: 'Track 8 (Cue)' }
];

export const DB = {
  getPresets(): Preset[] {
    return readJson<Preset[]>('presets.json', DEFAULT_PRESETS);
  },
  getPresetByPC(program: number, channel?: number): Preset | undefined {
    const list = this.getPresets();
    return list.find(p => {
      if (p.midiPC === null || p.midiPC === undefined) return false;
      if (p.midiPC !== program) return false;
      if (p.midiChannel !== null && p.midiChannel !== undefined && channel !== undefined) {
        return p.midiChannel === channel;
      }
      return true;
    });
  },
  savePreset(preset: Preset): Preset {
    const list = this.getPresets();
    const idx = list.findIndex(p => p.id === preset.id);
    if (idx >= 0) {
      list[idx] = preset;
    } else {
      list.push(preset);
    }
    writeJson('presets.json', list);
    return preset;
  },
  deletePreset(id: string): boolean {
    const list = this.getPresets();
    const filtered = list.filter(p => p.id !== id);
    if (filtered.length !== list.length) {
      writeJson('presets.json', filtered);
      return true;
    }
    return false;
  },
  getSettings(): Record<string, any> {
    return readJson('settings.json', {
      midiChannels: { quarter_inch: 3, xlr: 4, phones: 5 },
      trackNames: {},
      unusedTracks: {}
    });
  },
  saveSettings(settings: Record<string, any>) {
    writeJson('settings.json', settings);
  },
  logAudit(action: string, details: Record<string, any>) {
    const logs = readJson<any[]>('audit_logs.json', []);
    logs.unshift({
      timestamp: new Date().toISOString(),
      action,
      details
    });
    if (logs.length > 200) logs.pop();
    writeJson('audit_logs.json', logs);
  }
};
