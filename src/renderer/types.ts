export interface ChannelDefinition {
  id: string;
  name: string;
  category: 'master' | 'path' | 'song' | 'track' | 'utility' | 'input';
  levelCC: number;
  panCC: number;
  muteCC: number;
  soloCC: number;
  defaultLevel: number;
  defaultPan: number;
  isUnused?: boolean;
}

export interface StemDefinition {
  id: string;
  stem: string;
  name: string;
}

export interface LayerConfig {
  id: 'quarter_inch' | 'xlr' | 'phones';
  name: string;
  defaultMidiChannel: number;
  color: string;
}

export interface ChannelState {
  level: number;       // 0 - 127
  pan: number;         // 0 - 127 (64 = center)
  mute: boolean;
  solo: boolean;
  name?: string;
  isUnused?: boolean;
}

export interface LayerState {
  midiChannel: number;
  channels: Record<string, ChannelState>;
}

export type PcListener = (channel: number, program: number) => void;

export interface Preset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  midiPC?: number | null;      // Optional MIDI Program Change trigger (0-127)
  midiChannel?: number | null; // Optional MIDI Channel trigger (1-16, or null for Omni/Any)
  layers: {
    quarter_inch: LayerState;
    xlr: LayerState;
    phones: LayerState;
  };
}

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface MidiMessageEvent {
  timestamp: string;
  direction: 'in' | 'out';
  channel: number;
  cc: number;
  value: number;
  description: string;
}

export interface UserSession {
  id: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'BAND_MEMBER';
}
