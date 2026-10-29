import React from 'react';
import { ChannelDefinition, ChannelState } from '../types';

interface Props {
  def: ChannelDefinition;
  state: ChannelState;
  midiChannel: number;
  onUpdate: (updates: Partial<ChannelState>) => void;
  onSendMidi: (cc: number, value: number, desc?: string) => void;
  onOpenRename?: (def: ChannelDefinition, currentName: string) => void;
}

function parseChannelDisplay(rawName: string, id: string, category: string) {
  // If format is "Track X (Instrument)"
  const match = rawName.match(/^(?:Track\s*(\d+)|Path\s*([0-9A-Za-z]+))\s*\((.+)\)$/i);
  if (match) {
    if (match[1]) {
      return {
        badge: `TRK ${match[1]}`,
        mainTitle: match[3].trim(),
        subText: `Track ${match[1]}`
      };
    }
  }

  // If plain "Track X"
  const plainTrack = rawName.match(/^Track\s*(\d+)$/i);
  if (plainTrack) {
    return {
      badge: `TRK ${plainTrack[1]}`,
      mainTitle: `TRACK ${plainTrack[1]}`,
      subText: ''
    };
  }

  // Home master
  if (id === 'home' || rawName.toLowerCase().startsWith('home')) {
    return {
      badge: 'MASTER',
      mainTitle: 'HOME',
      subText: 'All Paths'
    };
  }

  // Song stem master
  if (id === 'song' || rawName.toLowerCase().startsWith('song')) {
    return {
      badge: 'SONG',
      mainTitle: 'ALL TRKS',
      subText: 'Stems Master'
    };
  }

  // Path 1A, 1B etc
  if (id.startsWith('path_')) {
    const p = id.replace('path_', '').toUpperCase();
    return {
      badge: 'PATH',
      mainTitle: p,
      subText: rawName
    };
  }

  // External inputs
  if (category === 'input') {
    return {
      badge: 'INPUT',
      mainTitle: rawName.toUpperCase(),
      subText: ''
    };
  }

  // Utility
  if (category === 'utility') {
    return {
      badge: 'UTIL',
      mainTitle: rawName.toUpperCase(),
      subText: ''
    };
  }

  const badge = id.startsWith('track_') ? `TRK ${id.replace('track_', '')}` : category.toUpperCase();
  return {
    badge,
    mainTitle: rawName.toUpperCase(),
    subText: ''
  };
}

function getChannelAccent(id: string, name: string, category: string): { color: string; border: string } {
  const low = (name + ' ' + id).toLowerCase();
  if (id === 'track_1' || low.includes('drum')) return { color: '#fbbf24', border: '#f59e0b' }; // Amber
  if (id === 'track_2' || low.includes('bass')) return { color: '#60a5fa', border: '#3b82f6' }; // Electric Blue
  if (id === 'track_3' || low.includes('piano') || low.includes('keys')) return { color: '#c084fc', border: '#a855f7' }; // Purple
  if (id === 'track_4' || low.includes('guitar')) return { color: '#34d399', border: '#10b981' }; // Emerald
  if (id === 'track_5' || low.includes('other')) return { color: '#2dd4bf', border: '#14b8a6' }; // Teal
  if (id === 'track_6' || low.includes('vocal') || low.includes('voc')) return { color: '#f472b6', border: '#ec4899' }; // Pink
  if (id === 'track_7' || low.includes('click')) return { color: '#fde047', border: '#eab308' }; // Gold
  if (id === 'track_8' || low.includes('cue') || low.includes('guide') || low.includes('fx')) return { color: '#a78bfa', border: '#8b5cf6' }; // Violet
  if (category === 'master') return { color: '#94a3b8', border: '#64748b' };
  if (category === 'path') return { color: '#38bdf8', border: '#0284c7' };
  if (category === 'utility') return { color: '#fbbf24', border: '#d97706' };
  if (category === 'input') return { color: '#22d3ee', border: '#0891b2' };
  return { color: '#38bdf8', border: '#2563eb' };
}

function levelToDb(val: number): string {
  if (val === 0) return '-∞ dB';
  // Map 100 to 0dB, 127 to +6dB, 1 to -48dB
  if (val === 100) return '0.0 dB';
  if (val > 100) {
    const db = ((val - 100) / 27) * 6;
    return `+${db.toFixed(1)} dB`;
  } else {
    const db = ((100 - val) / 100) * -48;
    return `${db.toFixed(1)} dB`;
  }
}

function panToText(pan: number): string {
  if (pan === 64) return 'C';
  if (pan < 64) {
    const pct = Math.round(((64 - pan) / 64) * 100);
    return `L${pct}`;
  } else {
    const pct = Math.round(((pan - 64) / 63) * 100);
    return `R${pct}`;
  }
}

export const ChannelStrip: React.FC<Props> = ({
  def,
  state,
  midiChannel,
  onUpdate,
  onSendMidi,
  onOpenRename
}) => {
  const isUnused = state.isUnused ?? false;
  const currentFullName = state.name || def.name;
  const display = parseChannelDisplay(currentFullName, def.id, def.category);
  const accent = getChannelAccent(def.id, currentFullName, def.category);

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onUpdate({ level: val });
    onSendMidi(def.levelCC, val, `${currentFullName} Level: ${val} (${levelToDb(val)})`);
  };

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onUpdate({ pan: val });
    onSendMidi(def.panCC, val, `${currentFullName} Pan: ${panToText(val)}`);
  };

  const handleResetPan = () => {
    onUpdate({ pan: 64 });
    onSendMidi(def.panCC, 64, `${currentFullName} Pan reset to Center`);
  };

  const handleToggleMute = () => {
    const next = !state.mute;
    onUpdate({ mute: next });
    // Helix Stadium 1.4: values >= 64 toggle state
    onSendMidi(def.muteCC, 127, `${currentFullName} Mute ${next ? 'ON' : 'OFF'}`);
  };

  const handleToggleSolo = () => {
    const next = !state.solo;
    onUpdate({ solo: next });
    // Helix Stadium 1.4: values >= 64 toggle state
    onSendMidi(def.soloCC, 127, `${currentFullName} Solo ${next ? 'ON' : 'OFF'}`);
  };

  const handleRename = () => {
    const current = state.name || def.name;
    const next = prompt(`New name for ${current}:`, current);
    if (next !== null && next.trim() !== '') {
      onUpdate({ name: next.trim() });
    }
  };

  const handleToggleUnused = () => {
    onUpdate({ isUnused: !isUnused });
  };

  const handleScribbleClick = () => {
    if (onOpenRename) {
      onOpenRename(def, currentFullName);
    } else {
      handleRename();
    }
  };

  return (
    <div className={`channel-strip ${isUnused ? 'unused' : ''} ${state.solo ? 'is-soloed' : ''} ${state.mute ? 'is-muted' : ''}`}>
      {/* High-Visibility Console Scribble Strip (Digital Console OLED Display) */}
      <div
        className="scribble-strip"
        onClick={handleScribbleClick}
        title={`Click to rename channel: ${currentFullName}`}
        style={{ '--accent-color': accent.color, '--accent-border': accent.border } as React.CSSProperties}
      >
        <div className="scribble-top-bar" style={{ backgroundColor: accent.border }} />

        <div className="scribble-meta-row">
          <span className="scribble-badge">{display.badge}</span>
          <span className="scribble-cc">CC{def.levelCC}</span>
        </div>

        <div className="scribble-main-title" style={{ color: accent.color }}>
          {display.mainTitle}
        </div>

        {display.subText ? (
          <div className="scribble-sub-text">{display.subText}</div>
        ) : (
          <div className="scribble-edit-hint">✎</div>
        )}
      </div>

      {/* Pan Section with Reset Button (Stadium 1.4 Feature) */}
      <div className="strip-pan-section">
        <div className="strip-pan-row">
          <span className="pan-label">PAN</span>
          <button className="pan-reset-btn" onClick={handleResetPan} title="Reset to Center (64)">
            RESET
          </button>
        </div>
        <input
          type="range"
          min="0"
          max="127"
          value={state.pan}
          onChange={handlePanChange}
          className="pan-slider"
          title={`Pan: ${panToText(state.pan)}`}
        />
        <span className="pan-value-text">{panToText(state.pan)}</span>
      </div>

      {/* Mute and Solo Buttons */}
      <div className="strip-buttons">
        <button
          className={`strip-btn mute ${state.mute ? 'active' : ''}`}
          onClick={handleToggleMute}
          title="Mute Channel (CC toggle)"
        >
          M
        </button>
        <button
          className={`strip-btn solo ${state.solo ? 'active' : ''}`}
          onClick={handleToggleSolo}
          title="Solo Channel (CC toggle)"
        >
          S
        </button>
      </div>

      {/* Fader Area */}
      <div className="strip-fader-area">
        <div className="fader-track-ticks">
          <span>+6</span>
          <span>0</span>
          <span>-6</span>
          <span>-18</span>
          <span>-∞</span>
        </div>
        <input
          type="range"
          min="0"
          max="127"
          value={state.level}
          onChange={handleLevelChange}
          className="fader-vertical"
          title={`Level: ${state.level} (${levelToDb(state.level)})`}
        />
      </div>

      {/* Footer dB readout & Unused toggle */}
      <div className="strip-footer">
        <div className="level-db-box">{levelToDb(state.level)}</div>
        <button
          className="unused-toggle-btn"
          onClick={handleToggleUnused}
          title="Toggle active/inactive (Helix Stadium 1.4 Grayed out view)"
        >
          {isUnused ? 'Make Active' : 'Unused'}
        </button>
      </div>
    </div>
  );
};
