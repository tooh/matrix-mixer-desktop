import React, { useState, useEffect } from 'react';
import { ChannelDefinition } from '../types';
import { levelToDb } from './ChannelStrip';

interface Props {
  isOpen: boolean;
  channel: ChannelDefinition | null;
  currentName: string;
  currentLevel?: number;
  channelDefaultLevel?: number;
  onClose: () => void;
  onSave: (channelId: string, newName: string, allLayers: boolean) => void;
  onApplyShowcaseAll: () => void;
  onSetDefaultLevel?: (channelId: string, level: number) => void;
}

const QUICK_STEMS = [
  { label: 'Drums', icon: '🥁', color: '#f59e0b' },
  { label: 'Bass', icon: '🎸', color: '#3b82f6' },
  { label: 'Piano', icon: '🎹', color: '#a855f7' },
  { label: 'Guitar', icon: '🎸', color: '#10b981' },
  { label: 'Other', icon: '🎛️', color: '#14b8a6' },
  { label: 'Vocals', icon: '🎤', color: '#ec4899' },
  { label: 'Click', icon: '⏱️', color: '#eab308' },
  { label: 'Cue', icon: '🗣️', color: '#8b5cf6' }
];

export const TrackRenameModal: React.FC<Props> = ({
  isOpen,
  channel,
  currentName,
  currentLevel = 100,
  channelDefaultLevel = 100,
  onClose,
  onSave,
  onApplyShowcaseAll,
  onSetDefaultLevel
}) => {
  const [name, setName] = useState('');
  const [allLayers, setAllLayers] = useState(true);
  const [localDefaultLevel, setLocalDefaultLevel] = useState<number>(channelDefaultLevel);

  useEffect(() => {
    if (channel) {
      setName(currentName || channel.name);
      setLocalDefaultLevel(channelDefaultLevel);
    }
  }, [channel, currentName, channelDefaultLevel, isOpen]);

  if (!isOpen || !channel) return null;

  const handleSelectStem = (stemLabel: string) => {
    // If it is a track (track_1 to track_8), format nicely as e.g. Track 1 (Drums) or just Drums
    if (channel.id.startsWith('track_')) {
      const trkNum = channel.id.replace('track_', '');
      setName(`Track ${trkNum} (${stemLabel})`);
    } else {
      setName(stemLabel);
    }
  };

  const handleApplyDefault = (level: number) => {
    setLocalDefaultLevel(level);
    if (onSetDefaultLevel) {
      onSetDefaultLevel(channel.id, level);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(channel.id, name.trim(), allLayers);
      onClose();
    }
  };

  const handleBatchApply = () => {
    onApplyShowcaseAll();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog rename-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🎛️ Rename Channel & Showcase Stems</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Channel info banner */}
          <div className="rename-channel-info">
            <span className={`strip-category-pill ${channel.category}`}>{channel.category}</span>
            <strong className="rename-channel-id">{channel.id}</strong>
            <span className="rename-cc-badge">Level CC{channel.levelCC} | Pan CC{channel.panCC}</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Channel Name / Instrument
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="modal-input"
                autoFocus
                placeholder="e.g. Track 1 (Drums) or Drums"
              />
            </div>

            {/* Quick Stem Selection Pills */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Quick Showcase Stem Selection
              </label>
              <div className="stem-pills-grid">
                {QUICK_STEMS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className="stem-pill-btn"
                    style={{ '--stem-color': s.color } as React.CSSProperties}
                    onClick={() => handleSelectStem(s.label)}
                    title={`Set name to ${s.label}`}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="stem-pill-btn stem-reset"
                  onClick={() => setName(channel.name)}
                  title="Reset to factory default name"
                >
                  <span>🔄</span>
                  <span>Restore Default</span>
                </button>
              </div>
            </div>

            {/* All Layers Checkbox */}
            <label className="rename-checkbox-label">
              <input
                type="checkbox"
                checked={allLayers}
                onChange={(e) => setAllLayers(e.target.checked)}
              />
              <span>Apply to all 3 layers (1/4" Out, XLR Out, Phones Out)</span>
            </label>

            {/* Batch Apply Showcase 6-Stem Template Card */}
            <div className="showcase-batch-card">
              <div className="showcase-batch-header">
                <span className="showcase-batch-badge">Line 6 Showcase Stems</span>
                <strong>Apply Standard 8-Track Layout</strong>
              </div>
              <p className="showcase-batch-desc">
                Directly applies the standard stem layout to Tracks 1 through 8:
                <br />
                <span className="showcase-stem-chips">
                  <strong>1</strong> Drums • <strong>2</strong> Bass • <strong>3</strong> Piano • <strong>4</strong> Guitar • <strong>5</strong> Other • <strong>6</strong> Vocals • <strong>7</strong> Click • <strong>8</strong> Cue
                </span>
              </p>
              <button
                type="button"
                className="btn btn-showcase-apply"
                onClick={handleBatchApply}
              >
                ⚡ Apply Showcase Layout to Tracks 1-8
              </button>
            </div>

            {/* Channel Default Fader Position (Uitgangspositie) */}
            <div style={{ background: '#0b1120', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🎯 Fader Uitgangspositie (Default Reset)
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>
                  {levelToDb(localDefaultLevel)} (CC {localDefaultLevel})
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
                Wanneer je dubbelklikt op de fader of op het dB-vakje klikt, springt het kanaal direct naar deze waarde.
                {currentLevel !== localDefaultLevel && (
                  <span style={{ display: 'block', color: '#f59e0b', marginTop: '2px' }}>
                    Huidige faderstand staat nu op {levelToDb(currentLevel)}.
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary-action"
                  style={{ fontSize: '11px', padding: '5px 10px', borderColor: '#3b82f6', color: '#93c5fd' }}
                  onClick={() => handleApplyDefault(currentLevel)}
                  title="Stel de huidige faderstand in als default uitgangspositie voor dit kanaal"
                >
                  📍 Huidige stand ({levelToDb(currentLevel)}) als default
                </button>
                <button
                  type="button"
                  className="btn btn-secondary-action"
                  style={{ fontSize: '11px', padding: '5px 10px', borderColor: '#475569' }}
                  onClick={() => handleApplyDefault(100)}
                  title="Herstel default naar 0.0 dB"
                >
                  🔄 Reset naar 0.0 dB
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions" style={{ marginTop: '6px' }}>
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Name
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
