import React, { useEffect, useState } from 'react';
import { MIDI } from '../midiService';
import { MidiPortInfo, MidiMessageEvent } from '../types';
import { apiRequest } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  midiChannels: { quarter_inch: number; xlr: number; phones: number };
  onUpdateChannels: (channels: { quarter_inch: number; xlr: number; phones: number }) => void;
  recallScope?: 'active_layer' | 'all_layers';
  onUpdateRecallScope?: (scope: 'active_layer' | 'all_layers') => void;
  activeLayerName?: string;
  isAdmin?: boolean;
}

export const MidiSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  midiChannels,
  onUpdateChannels,
  recallScope = 'active_layer',
  onUpdateRecallScope,
  activeLayerName = 'Current Layer',
  isAdmin = false
}) => {
  const [inputs, setInputs] = useState<MidiPortInfo[]>([]);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [selectedIn, setSelectedIn] = useState<string>('');
  const [selectedOut, setSelectedOut] = useState<string>('');
  const [logs, setLogs] = useState<MidiMessageEvent[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'in' | 'out'>('all');
  const [logSortOrder, setLogSortOrder] = useState<'newest' | 'chronological'>('chronological');
  const [serverDevices, setServerDevices] = useState<string[]>([]);
  const [activeServerDev, setActiveServerDev] = useState<string>('');

  const loadServerDevices = () => {
    apiRequest<{ devices: string[]; activeDevice?: string }>('/api/midi/devices')
      .then(d => {
        if (d.devices) setServerDevices(d.devices);
        if (d.activeDevice) setActiveServerDev(d.activeDevice);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;

    setInputs(MIDI.getInputs());
    setOutputs(MIDI.getOutputs());
    setSelectedIn(MIDI.getSelectedInputId());
    setSelectedOut(MIDI.getSelectedOutputId());
    setLogs(MIDI.getLogs());
    loadServerDevices();

    const unsub = MIDI.addLogListener(() => {
      setLogs(MIDI.getLogs());
    });

    return () => {
      unsub();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectServerDev = async (dev: string) => {
    if (!isAdmin) return;
    setActiveServerDev(dev);
    try {
      await apiRequest('/api/midi/device', {
        method: 'POST',
        body: JSON.stringify({ device: dev })
      });
    } catch (e) {
      console.warn('Failed to set server MIDI device:', e);
    }
  };

  const handleSelectIn = (id: string) => {
    setSelectedIn(id);
    MIDI.selectInput(id);
  };

  const handleSelectOut = (id: string) => {
    setSelectedOut(id);
    MIDI.selectOutput(id);
  };

  const handleTestPing = () => {
    // Send CC11 on active/default XLR channel
    MIDI.sendCC(midiChannels.xlr, 11, 100, 'Test Ping CC11 = 100');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🎛️ MIDI & Hardware Configuration (Line 6 Helix Stadium 1.4)</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {!isAdmin && (
            <div style={{ background: '#451a03', border: '1px solid #d97706', color: '#fde68a', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span>🔒</span>
              <span><strong>Read-Only Mode:</strong> Hardware USB device selection and MIDI output channels require Administrator permissions.</span>
            </div>
          )}

          {/* Server-Side USB MIDI (Mac -> Helix Stadium for iPhone / iPad support) */}
          <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}>
                  🔌 Mac USB CoreMIDI Relay (Bidirectional Ingress & Egress Active)
                </span>
                <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px' }}>
                  Active
                </span>
              </div>
              <button
                className="btn"
                style={{ padding: '2px 8px', fontSize: '10px' }}
                onClick={loadServerDevices}
                title="Refresh connected USB devices on Mac"
              >
                🔄 Refresh Devices
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
              Full-duplex CoreMIDI bridge: fader movements from iPhones/iPads are sent to Helix via USB, while incoming Showcase MIDI flags (like Program Changes) and hardware CCs are streamed back to mobile devices over Wi-Fi:
            </p>
            <div className="form-group">
              <select
                className="form-select"
                style={{ borderColor: '#10b981', opacity: isAdmin ? 1 : 0.65, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                disabled={!isAdmin}
                value={activeServerDev}
                onChange={(e) => handleSelectServerDev(e.target.value)}
              >
                <option value="">-- No specific target (Default MIDI bus) --</option>
                {serverDevices.map((d) => (
                  <option key={d} value={d}>
                    {d} {/helix|stadium/i.test(d) ? '⭐ (Helix Stadium Detected!)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hardware MIDI Ports (In-Browser Web MIDI for desktop Chrome/Edge) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">MIDI Input Port (From Controller / Helix):</label>
              <select
                className="form-select"
                value={selectedIn}
                onChange={(e) => handleSelectIn(e.target.value)}
              >
                <option value="all">🌟 All Connected Inputs (Omni Mode - Recommended)</option>
                <option value="">-- None / Software Simulation --</option>
                {inputs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.manufacturer ? `(${p.manufacturer})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">MIDI Output Port (To Helix Stadium):</label>
              <select
                className="form-select"
                value={selectedOut}
                onChange={(e) => handleSelectOut(e.target.value)}
              >
                <option value="">-- None / Software Simulation --</option>
                {outputs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.manufacturer ? `(${p.manufacturer})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Matrix Layers MIDI Channels according to 1.4 specs */}
          <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: '13px', marginBottom: '8px', color: '#38bdf8' }}>
              Matrix Output Layer MIDI Channels (Helix Stadium 1.4 Specification)
            </h4>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
              By default, Matrix 1/4" listens on Ch. 3, XLR on Ch. 4, and Phones on Ch. 5.
              You can bind layers to the same channel so one physical controller operates multiple outputs simultaneously.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Matrix &gt; 1/4" Out:</label>
                <select
                  className="form-select"
                  disabled={!isAdmin}
                  style={{ opacity: isAdmin ? 1 : 0.65, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                  value={midiChannels.quarter_inch}
                  onChange={(e) => onUpdateChannels({ ...midiChannels, quarter_inch: parseInt(e.target.value, 10) })}
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                    <option key={ch} value={ch}>MIDI Channel {ch} {ch === 3 ? '(Default)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Matrix &gt; XLR Out:</label>
                <select
                  className="form-select"
                  disabled={!isAdmin}
                  style={{ opacity: isAdmin ? 1 : 0.65, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                  value={midiChannels.xlr}
                  onChange={(e) => onUpdateChannels({ ...midiChannels, xlr: parseInt(e.target.value, 10) })}
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                    <option key={ch} value={ch}>MIDI Channel {ch} {ch === 4 ? '(Default)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Matrix &gt; Phones Out:</label>
                <select
                  className="form-select"
                  disabled={!isAdmin}
                  style={{ opacity: isAdmin ? 1 : 0.65, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                  value={midiChannels.phones}
                  onChange={(e) => onUpdateChannels({ ...midiChannels, phones: parseInt(e.target.value, 10) })}
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                    <option key={ch} value={ch}>MIDI Channel {ch} {ch === 5 ? '(Default)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preset Recall Scope Section */}
          {onUpdateRecallScope && (
            <div style={{
              background: '#090d16',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🎯 Preset Recall Scope (MIDI Scenes &amp; PC Triggers)
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Controls CC dispatch on song / preset trigger
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
                    name="modalRecallScope"
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
                    name="modalRecallScope"
                    value="all_layers"
                    checked={recallScope === 'all_layers'}
                    onChange={() => onUpdateRecallScope('all_layers')}
                  />
                  <span>All 3 Layers (Full Console • 114 CCs)</span>
                </label>
              </div>
            </div>
          )}

          {/* MIDI Live Monitor */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label className="form-label" style={{ margin: 0 }}>Live MIDI Monitor:</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className={`btn ${logFilter === 'all' ? 'btn-primary' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => setLogFilter('all')}
                  >
                    All ({logs.length})
                  </button>
                  <button
                    className={`btn ${logFilter === 'in' ? 'btn-primary' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '10px', color: logFilter === 'in' ? '#fff' : '#34d399' }}
                    onClick={() => setLogFilter('in')}
                  >
                    ⬅️ IN ({logs.filter(l => l.direction === 'in').length})
                  </button>
                  <button
                    className={`btn ${logFilter === 'out' ? 'btn-primary' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '10px', color: logFilter === 'out' ? '#fff' : '#38bdf8' }}
                    onClick={() => setLogFilter('out')}
                  >
                    ➡️ OUT ({logs.filter(l => l.direction === 'out').length})
                  </button>
                </div>
                {/* Order Toggle */}
                <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                  <button
                    className={`btn ${logSortOrder === 'chronological' ? 'btn-primary' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => setLogSortOrder('chronological')}
                    title="Chronological order: IN triggers at the top, followed by outgoing sweeps"
                  >
                    ⬆️ Chronological
                  </button>
                  <button
                    className={`btn ${logSortOrder === 'newest' ? 'btn-primary' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => setLogSortOrder('newest')}
                    title="Newest first: latest message at the top"
                  >
                    ⬇️ Newest First
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn"
                  style={{ padding: '2px 8px', fontSize: '10px', color: '#94a3b8' }}
                  onClick={() => MIDI.clearLogs()}
                  title="Clear log history"
                >
                  🗑️ Clear
                </button>
                <button className="btn" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={handleTestPing}>
                  ⚡ Send Test CC
                </button>
              </div>
            </div>
            <div className="midi-log-console" style={{ maxHeight: '200px' }}>
              {(() => {
                const filtered = logs.filter(l => logFilter === 'all' || l.direction === logFilter);
                const displayItems = logSortOrder === 'chronological' ? [...filtered].reverse() : filtered;

                if (displayItems.length === 0) {
                  return <span style={{ color: '#64748b' }}>No {logFilter === 'all' ? 'MIDI' : logFilter.toUpperCase()} messages logged yet...</span>;
                }

                return displayItems.map((l, idx) => (
                  <div key={idx} className={`midi-log-row ${l.direction}`}>
                    <span style={{ minWidth: '95px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>[{l.timestamp}]</span>
                    <span style={{ minWidth: '60px', fontWeight: 'bold' }}>{l.direction === 'in' ? '⬅️ IN' : '➡️ OUT'}</span>
                    <span>{l.description}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
