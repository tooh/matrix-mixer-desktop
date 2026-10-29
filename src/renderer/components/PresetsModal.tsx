import React, { useState } from 'react';
import { Preset } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  presets: Preset[];
  onLoadPreset: (preset: Preset) => void;
  onSavePreset: (name: string, description: string, midiPC?: number | null, midiChannel?: number | null) => void;
  onUpdatePreset?: (id: string, updates: Partial<Preset>) => void;
  onDeletePreset: (id: string) => void;
  recallScope?: 'active_layer' | 'all_layers';
  onUpdateRecallScope?: (scope: 'active_layer' | 'all_layers') => void;
  activeLayerName?: string;
  onOverwritePreset?: (preset: Preset) => void;
}

export const PresetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  presets,
  onLoadPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
  recallScope = 'active_layer',
  onUpdateRecallScope,
  activeLayerName = 'Current Layer',
  onOverwritePreset
}) => {
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [newPresetPC, setNewPresetPC] = useState<string>('');
  const [newPresetChannel, setNewPresetChannel] = useState<string>('omni');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPC, setEditPC] = useState<string>('');
  const [editChannel, setEditChannel] = useState<string>('omni');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPresetName.trim();
    if (!trimmed) return;

    // Check if preset with identical name already exists
    const existing = presets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (existing && onOverwritePreset) {
      if (window.confirm(`A preset named "${existing.name}" already exists. Do you want to overwrite it with the current mix?`)) {
        onOverwritePreset(existing);
        setNewPresetName('');
        setNewPresetDesc('');
        setNewPresetPC('');
        setNewPresetChannel('omni');
        return;
      }
    }

    const pcVal = newPresetPC.trim() !== '' ? parseInt(newPresetPC, 10) : null;
    const chVal = newPresetChannel !== 'omni' ? parseInt(newPresetChannel, 10) : null;

    onSavePreset(trimmed, newPresetDesc.trim(), pcVal, chVal);
    setNewPresetName('');
    setNewPresetDesc('');
    setNewPresetPC('');
    setNewPresetChannel('omni');
  };

  const startEdit = (p: Preset) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description);
    setEditPC(p.midiPC !== null && p.midiPC !== undefined ? p.midiPC.toString() : '');
    setEditChannel(p.midiChannel ? p.midiChannel.toString() : 'omni');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditSave = (p: Preset) => {
    if (!onUpdatePreset) return;
    const pcVal = editPC.trim() !== '' ? parseInt(editPC, 10) : null;
    const chVal = editChannel !== 'omni' ? parseInt(editChannel, 10) : null;

    onUpdatePreset(p.id, {
      name: editName.trim() || p.name,
      description: editDesc.trim(),
      midiPC: pcVal !== null && !isNaN(pcVal) ? Math.max(0, Math.min(127, pcVal)) : null,
      midiChannel: chVal !== null && !isNaN(chVal) ? Math.max(1, Math.min(16, chVal)) : null
    });
    setEditingId(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">💾 Mix Presets & Showcase MIDI Scenes</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Preset Recall Scope Selection */}
          {onUpdateRecallScope && (
            <div style={{
              background: '#0b1329',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🎯 Preset Recall Scope
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Controls CC dispatch on recall &amp; MIDI PC
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: recallScope === 'active_layer' ? '#38bdf8' : '#cbd5e1',
                  fontWeight: recallScope === 'active_layer' ? 600 : 400
                }}>
                  <input
                    type="radio"
                    name="recallScope"
                    value="active_layer"
                    checked={recallScope === 'active_layer'}
                    onChange={() => onUpdateRecallScope('active_layer')}
                  />
                  <span>Active Layer Only ({activeLayerName} • 38 CCs)</span>
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: recallScope === 'all_layers' ? '#38bdf8' : '#cbd5e1',
                  fontWeight: recallScope === 'all_layers' ? 600 : 400
                }}>
                  <input
                    type="radio"
                    name="recallScope"
                    value="all_layers"
                    checked={recallScope === 'all_layers'}
                    onChange={() => onUpdateRecallScope('all_layers')}
                  />
                  <span>All 3 Layers (Full Console • 114 CCs)</span>
                </label>
              </div>
            </div>
          )}

          {/* Preset List */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>Saved Mix Scenes & MIDI Triggers:</label>
              <span style={{ fontSize: '11px', color: '#38bdf8' }}>⚡ Auto-loads on Showcase MIDI PC</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              {presets.map((p) => {
                const isEditing = editingId === p.id;
                const hasPC = p.midiPC !== null && p.midiPC !== undefined;

                if (isEditing) {
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: '#131b2e',
                        border: '1px solid #38bdf8',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 2, fontSize: '12px', padding: '4px 8px' }}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Preset Name"
                        />
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 3, fontSize: '12px', padding: '4px 8px' }}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Trigger PC (0-127):</span>
                        <input
                          type="number"
                          className="form-input"
                          min="0"
                          max="127"
                          style={{ width: '75px', fontSize: '12px', padding: '4px 8px' }}
                          placeholder="None"
                          value={editPC}
                          onChange={(e) => setEditPC(e.target.value)}
                        />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Channel:</span>
                        <select
                          className="form-select"
                          style={{ width: '110px', fontSize: '12px', padding: '4px 8px' }}
                          value={editChannel}
                          onChange={(e) => setEditChannel(e.target.value)}
                        >
                          <option value="omni">Omni (Any)</option>
                          {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                            <option key={ch} value={ch}>Ch {ch}</option>
                          ))}
                        </select>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => handleEditSave(p)}
                          >
                            Save
                          </button>
                          <button
                            className="btn"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={p.id}
                    style={{
                      background: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#f8fafc' }}>{p.name}</span>
                        {hasPC ? (
                          <span
                            style={{
                              fontSize: '10px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid #0284c7',
                              borderRadius: '4px',
                              padding: '1px 6px',
                              fontWeight: 600
                            }}
                            title={`Recalls automatically when Helix Stadium sends MIDI Program Change ${p.midiPC}`}
                          >
                            ⚡ PC: {p.midiPC} {p.midiChannel ? `(Ch ${p.midiChannel})` : '(Omni)'}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10px',
                              color: '#64748b',
                              background: '#1e293b',
                              borderRadius: '4px',
                              padding: '1px 5px'
                            }}
                          >
                            No MIDI PC
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => {
                          onLoadPreset(p);
                          onClose();
                        }}
                      >
                        Load
                      </button>
                      {onOverwritePreset && (
                        <button
                          className="btn"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            color: '#fbbf24',
                            borderColor: '#d97706',
                            background: 'rgba(245, 158, 11, 0.1)'
                          }}
                          onClick={() => {
                            if (window.confirm(`Overwrite preset "${p.name}" with current console mix faders and pan?`)) {
                              onOverwritePreset(p);
                            }
                          }}
                          title="Overwrite this preset with the current console fader & pan positions"
                        >
                          💾 Overwrite
                        </button>
                      )}
                      <button
                        className="btn"
                        style={{ padding: '3px 8px', fontSize: '11px', color: '#38bdf8' }}
                        onClick={() => startEdit(p)}
                        title="Edit preset name, description, or MIDI PC trigger"
                      >
                        Edit
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }}
                        onClick={() => onDeletePreset(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Current Mix */}
          <form onSubmit={handleSave} style={{ borderTop: '1px solid #27354f', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '13px', color: '#38bdf8', margin: 0 }}>Save Current Mix as New Preset</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Preset Name:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Showcase Song 1 (Intro/Chorus)"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ width: '130px' }}>
                <label className="form-label" title="Helix Stadium Program Change (0-127)">MIDI PC Trigger:</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="127"
                  placeholder="e.g. 5 (Optional)"
                  value={newPresetPC}
                  onChange={(e) => setNewPresetPC(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ width: '130px' }}>
                <label className="form-label">MIDI Channel:</label>
                <select
                  className="form-select"
                  value={newPresetChannel}
                  onChange={(e) => setNewPresetChannel(e.target.value)}
                >
                  <option value="omni">Omni (Any)</option>
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                    <option key={ch} value={ch}>Ch {ch}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description / Notes:</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Vocals & Click boosted for In-Ears; FOH drums leveled"
                value={newPresetDesc}
                onChange={(e) => setNewPresetDesc(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
              💾 Save Mix Scene
            </button>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
