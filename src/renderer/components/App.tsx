import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ChannelDefinition, LayerConfig, LayerState, Preset, UserSession } from '../types';
import { apiRequest } from '../api';
import { MIDI } from '../midiService';
import { MixerConsole } from './MixerConsole';
import { MidiSettingsModal } from './MidiSettingsModal';
import { PresetsModal } from './PresetsModal';
import { DocumentationModal } from './DocumentationModal';
import { ScrumIssueModal } from './ScrumIssueModal';
import { LoginModal } from './LoginModal';
import { TrackRenameModal } from './TrackRenameModal';

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.5';

interface ToastState {
  type: 'recall' | 'general';
  title: string;
  message: string;
  badge?: string;
  pc?: number;
}

export const App: React.FC = () => {
  const [channels, setChannels] = useState<ChannelDefinition[]>([]);
  const [layers, setLayers] = useState<LayerConfig[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<'quarter_inch' | 'xlr' | 'phones'>('xlr');
  
  // Preset Recall Scope: 'active_layer' (38 CCs) or 'all_layers' (114 CCs)
  const [presetRecallScope, setPresetRecallScope] = useState<'active_layer' | 'all_layers'>(() => {
    return (localStorage.getItem('matrix_preset_recall_scope') as 'active_layer' | 'all_layers') || 'active_layer';
  });

  const presetRecallScopeRef = useRef<'active_layer' | 'all_layers'>(presetRecallScope);
  useEffect(() => {
    presetRecallScopeRef.current = presetRecallScope;
  }, [presetRecallScope]);

  const activeLayerIdRef = useRef<'quarter_inch' | 'xlr' | 'phones'>(activeLayerId);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  const handleUpdateRecallScope = (scope: 'active_layer' | 'all_layers') => {
    presetRecallScopeRef.current = scope;
    setPresetRecallScope(scope);
    localStorage.setItem('matrix_preset_recall_scope', scope);
  };
  
  // Layer states: level, pan, mute, solo for each channel
  const [layersData, setLayersData] = useState<{
    quarter_inch: LayerState;
    xlr: LayerState;
    phones: LayerState;
  }>({
    quarter_inch: { midiChannel: 3, channels: {} },
    xlr: { midiChannel: 4, channels: {} },
    phones: { midiChannel: 5, channels: {} }
  });

  const [presets, setPresets] = useState<Preset[]>([]);
  const presetsRef = useRef<Preset[]>(presets);
  useEffect(() => {
    presetsRef.current = presets;
  }, [presets]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [lockedLayer, setLockedLayer] = useState<boolean>(false);

  // Modals
  const [showMidiModal, setShowMidiModal] = useState<boolean>(false);
  const [showPresetsModal, setShowPresetsModal] = useState<boolean>(false);
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [showScrumModal, setShowScrumModal] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [renameTarget, setRenameTarget] = useState<{ def: ChannelDefinition; currentName: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<any>(null);

  // PWA Version Update Management
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState<boolean>(false);

  // Check for PWA updates by querying /version.txt on mount, periodically, and on focus
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/version.txt?t=' + Date.now());
        if (response.ok) {
          const serverVersion = (await response.text()).trim();
          if (serverVersion && serverVersion !== APP_VERSION) {
            console.log(`[PWA Update] Update available! Local: ${APP_VERSION}, Server: ${serverVersion}`);
            setUpdateAvailable(serverVersion);
          }
        }
      } catch (err) {
        console.warn('Failed to check for PWA updates:', err);
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60 * 1000);

    const handleFocus = () => checkForUpdates();
    const handleVisibility = () => {
      if (!document.hidden) checkForUpdates();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  checkForUpdates();
                }
              };
            }
          };
        }
      });
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleForceUpdate = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await registration.unregister();
        }
      } catch (err) {
        console.error('Failed to unregister service worker:', err);
      }
    }
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      } catch (err) {
        console.error('Failed to clear caches:', err);
      }
    }
    window.location.reload();
  };

  const triggerToast = useCallback(
    (msg: string | { type?: 'recall' | 'general'; title?: string; message: string; badge?: string; pc?: number }) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

      if (typeof msg === 'string') {
        setToast({
          type: 'general',
          title: 'Mixer Notice',
          message: msg
        });
      } else {
        setToast({
          type: msg.type || 'general',
          title: msg.title || (msg.type === 'recall' ? 'Showcase Scene Recalled' : 'Mixer Notice'),
          message: msg.message,
          badge: msg.badge,
          pc: msg.pc
        });
      }

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, 5000);
    },
    []
  );

  // Initialize
  useEffect(() => {
    // 1. Fetch initial config from backend
    apiRequest<{ channels: ChannelDefinition[]; layers: LayerConfig[] }>('/api/config')
      .then((cfg) => {
        setChannels(cfg.channels);
        setLayers(cfg.layers);

        // Populate default channels
        const buildDefaultChannels = () => {
          const map: Record<string, any> = {};
          for (const ch of cfg.channels) {
            map[ch.id] = {
              level: ch.defaultLevel,
              pan: ch.defaultPan,
              mute: false,
              solo: false,
              name: ch.name,
              isUnused: false
            };
          }
          return map;
        };

        setLayersData({
          quarter_inch: { midiChannel: 3, channels: buildDefaultChannels() },
          xlr: { midiChannel: 4, channels: buildDefaultChannels() },
          phones: { midiChannel: 5, channels: buildDefaultChannels() }
        });
      })
      .catch((err) => console.error('Failed to load config:', err));

    // 2. Fetch presets
    apiRequest<Preset[]>('/api/presets')
      .then((res) => setPresets(res))
      .catch((err) => console.error('Failed to load presets:', err));

    // 3. Init MIDI
    MIDI.init();

    // 4. Check stored user
    const savedUser = localStorage.getItem('matrix_mixer_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  // Listen to incoming MIDI messages from external controller or Helix
  useEffect(() => {
    const unsub = MIDI.addListener((channel, cc, value) => {
      // Find matching layer
      let targetLayer: 'quarter_inch' | 'xlr' | 'phones' | null = null;
      if (layersData.quarter_inch.midiChannel === channel) targetLayer = 'quarter_inch';
      else if (layersData.xlr.midiChannel === channel) targetLayer = 'xlr';
      else if (layersData.phones.midiChannel === channel) targetLayer = 'phones';

      if (!targetLayer) return;

      // Handle Clear Solo CC103
      if (cc === 103 && value >= 64) {
        handleClearSolo(false);
        return;
      }

      // Check which channel definition owns this CC
      const foundDef = channels.find(
        (c) => c.levelCC === cc || c.panCC === cc || c.muteCC === cc || c.soloCC === cc
      );

      if (!foundDef) return;

      setLayersData((prev) => {
        const layerObj = prev[targetLayer!];
        const prevChan = layerObj.channels[foundDef.id] || {
          level: foundDef.defaultLevel,
          pan: foundDef.defaultPan,
          mute: false,
          solo: false,
          name: foundDef.name
        };

        let updated = { ...prevChan };
        if (cc === foundDef.levelCC) {
          updated.level = value;
        } else if (cc === foundDef.panCC) {
          updated.pan = value;
        } else if (cc === foundDef.muteCC) {
          if (value >= 64) updated.mute = !updated.mute;
        } else if (cc === foundDef.soloCC) {
          if (value >= 64) updated.solo = !updated.solo;
        }

        return {
          ...prev,
          [targetLayer!]: {
            ...layerObj,
            channels: {
              ...layerObj.channels,
              [foundDef.id]: updated
            }
          }
        };
      });
    });

    return () => {
      unsub();
    };
  }, [channels, layersData]);

  // Listen to incoming MIDI Program Change (PC) triggers to auto-load presets
  useEffect(() => {
    const unsubPC = MIDI.addPcListener((channel, program) => {
      const currentPresets = presetsRef.current;
      const matched = currentPresets.find((p) => {
        if (p.midiPC === null || p.midiPC === undefined) return false;
        if (p.midiPC !== program) return false;
        if (p.midiChannel && p.midiChannel !== channel) return false;
        return true;
      });

      if (matched) {
        handleLoadPreset(matched);
        const storedScope = localStorage.getItem('matrix_preset_recall_scope');
        const currentScope = (storedScope as 'active_layer' | 'all_layers') || presetRecallScopeRef.current;
        const scopeBadge = currentScope === 'all_layers' ? 'All 3 Layers' : 'Active Layer';
        triggerToast({
          type: 'recall',
          title: 'Showcase Scene Recalled',
          message: `"${matched.name}"`,
          pc: program,
          badge: scopeBadge
        });
      }
    });

    return () => {
      unsubPC();
    };
  }, [channels]);

  const activeLayer = layers.find((l) => l.id === activeLayerId) || {
    id: activeLayerId,
    name: activeLayerId === 'xlr' ? 'Matrix > XLR Out' : 'Matrix Layer',
    defaultMidiChannel: activeLayerId === 'xlr' ? 4 : 3,
    color: activeLayerId === 'xlr' ? '#10b981' : '#3b82f6'
  };

  const currentLayerData = layersData[activeLayerId];

  // Send MIDI CC
  const handleSendMidi = useCallback((cc: number, value: number, desc?: string) => {
    MIDI.sendCC(currentLayerData.midiChannel, cc, value, desc);
  }, [currentLayerData.midiChannel]);

  // Update a single channel
  const handleUpdateChannel = (channelId: string, updates: Partial<any>) => {
    setLayersData((prev) => {
      const curLayer = prev[activeLayerId];
      const curChan = curLayer.channels[channelId] || {};
      return {
        ...prev,
        [activeLayerId]: {
          ...curLayer,
          channels: {
            ...curLayer.channels,
            [channelId]: {
              ...curChan,
              ...updates
            }
          }
        }
      };
    });
  };

  const handleOpenRename = (def: ChannelDefinition, currentName: string) => {
    setRenameTarget({ def, currentName });
  };

  const handleSaveRename = (channelId: string, newName: string, allLayers: boolean) => {
    setLayersData((prev) => {
      const updated = { ...prev };
      const targetLayerKeys = allLayers
        ? (['quarter_inch', 'xlr', 'phones'] as const)
        : ([activeLayerId] as const);

      for (const lk of targetLayerKeys) {
        const layer = updated[lk];
        const ch = layer.channels[channelId] || {};
        updated[lk] = {
          ...layer,
          channels: {
            ...layer.channels,
            [channelId]: {
              ...ch,
              name: newName
            }
          }
        };
      }
      return updated;
    });
    triggerToast(`Channel renamed to: "${newName}"`);
  };

  const handleApplyShowcaseStems = () => {
    const showcaseMap: Record<string, string> = {
      track_1: 'Track 1 (Drums)',
      track_2: 'Track 2 (Bass)',
      track_3: 'Track 3 (Piano)',
      track_4: 'Track 4 (Guitar)',
      track_5: 'Track 5 (Other)',
      track_6: 'Track 6 (Vocals)',
      track_7: 'Track 7 (Click)',
      track_8: 'Track 8 (Cue)'
    };

    setLayersData((prev) => {
      const updated = { ...prev };
      for (const lk of ['quarter_inch', 'xlr', 'phones'] as const) {
        const layer = updated[lk];
        const chs = { ...layer.channels };
        for (const [id, name] of Object.entries(showcaseMap)) {
          if (chs[id]) {
            chs[id] = { ...chs[id], name };
          } else {
            chs[id] = { name, level: 90, pan: 64, mute: false, solo: false, isUnused: false };
          }
        }
        updated[lk] = { ...layer, channels: chs };
      }
      return updated;
    });

    triggerToast('Showcase stems applied: Drums, Bass, Piano, Guitar, Other, Vocals, Click, Cue!');
  };

  // Dedicated Clear Solo (CC103)
  const handleClearSolo = (sendMidi: boolean = true) => {
    if (sendMidi) {
      // Send CC103 with value 127
      handleSendMidi(103, 127, 'Clear Solo (CC103: All Matrix Solos Reset)');
    }

    setLayersData((prev) => {
      const curLayer = prev[activeLayerId];
      const newChannels = { ...curLayer.channels };
      for (const k of Object.keys(newChannels)) {
        if (newChannels[k].solo) {
          newChannels[k] = { ...newChannels[k], solo: false };
        }
      }
      return {
        ...prev,
        [activeLayerId]: {
          ...curLayer,
          channels: newChannels
        }
      };
    });
  };

  // Any solo active on current layer?
  const hasActiveSolo = Object.values(currentLayerData?.channels || {}).some((c: any) => c.solo);

  // Update layer MIDI channels
  const handleUpdateLayerChannels = (newChannels: { quarter_inch: number; xlr: number; phones: number }) => {
    setLayersData((prev) => ({
      ...prev,
      quarter_inch: { ...prev.quarter_inch, midiChannel: newChannels.quarter_inch },
      xlr: { ...prev.xlr, midiChannel: newChannels.xlr },
      phones: { ...prev.phones, midiChannel: newChannels.phones }
    }));
  };

  // Load Preset
  const handleLoadPreset = (preset: Preset) => {
    const storedScope = localStorage.getItem('matrix_preset_recall_scope');
    const currentScope = (storedScope as 'active_layer' | 'all_layers') || presetRecallScopeRef.current || 'active_layer';
    const isAllLayers = currentScope === 'all_layers';
    const currentActiveLayer = activeLayerIdRef.current || activeLayerId;

    // Update state for all layers or active layer only
    setLayersData((prev) => {
      if (isAllLayers) {
        return preset.layers;
      }
      return {
        ...prev,
        [currentActiveLayer]: preset.layers[currentActiveLayer] || prev[currentActiveLayer]
      };
    });

    const targetLayerKeys = isAllLayers
      ? (['quarter_inch', 'xlr', 'phones'] as const)
      : ([currentActiveLayer] as const);

    const layerNameMap: Record<string, string> = {
      quarter_inch: '1/4" Out',
      xlr: 'XLR Out',
      phones: 'Phones Out'
    };

    // Send MIDI dump over MIDI for targeted layer(s)
    targetLayerKeys.forEach((layerKey) => {
      const cur = preset.layers[layerKey];
      const layerTitle = layerNameMap[layerKey] || layerKey;
      if (cur) {
        for (const [chId, st] of Object.entries(cur.channels)) {
          const def = channels.find((c) => c.id === chId);
          if (def) {
            const rawName = st.name || def.name;
            const match = rawName.match(/\(([^)]+)\)/);
            const chName = match && match[1] ? match[1] : rawName;

            MIDI.sendCC(cur.midiChannel, def.levelCC, st.level, `${layerTitle} • ${chName}: Level ${st.level}`);
            MIDI.sendCC(cur.midiChannel, def.panCC, st.pan, `${layerTitle} • ${chName}: Pan ${st.pan}`);
            if (st.mute) {
              MIDI.sendCC(cur.midiChannel, def.muteCC, 127, `${layerTitle} • ${chName}: Mute ON`);
            }
          }
        }
      }
    });
  };

  // Save Preset
  const handleSavePreset = async (
    name: string,
    description: string,
    midiPC?: number | null,
    midiChannel?: number | null
  ) => {
    try {
      const res = await apiRequest<Preset>('/api/presets', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          midiPC,
          midiChannel,
          layers: layersData
        })
      });
      setPresets((prev) => [...prev, res]);
      triggerToast(`💾 Saved preset "${name}"`);
    } catch (err: any) {
      alert(`Error saving preset: ${err.message}`);
    }
  };

  // Update existing Preset metadata or MIDI triggers
  const handleUpdatePreset = async (id: string, updates: Partial<Preset>) => {
    try {
      const res = await apiRequest<Preset>(`/api/presets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      setPresets((prev) => prev.map((p) => (p.id === id ? res : p)));
      triggerToast(`Preset "${res.name}" updated`);
    } catch (err: any) {
      alert(`Error updating preset: ${err.message}`);
    }
  };

  // Overwrite existing preset with current mixer faders
  const handleOverwritePreset = async (preset: Preset) => {
    try {
      const res = await apiRequest<Preset>(`/api/presets/${preset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          layers: layersData
        })
      });
      setPresets((prev) => prev.map((p) => (p.id === preset.id ? res : p)));
      triggerToast(`💾 Mix updated for preset "${preset.name}"!`);
    } catch (err: any) {
      alert(`Error overwriting preset: ${err.message}`);
    }
  };

  // Delete Preset
  const handleDeletePreset = async (id: string) => {
    try {
      await apiRequest(`/api/presets/${id}`, { method: 'DELETE' });
      setPresets((prev) => prev.filter((p) => p.id !== id));
      triggerToast('Preset deleted');
    } catch (err: any) {
      alert(`Error deleting preset: ${err.message}`);
    }
  };

  return (
    <>
      {/* PWA Version Update Banner */}
      {updateAvailable && !dismissedUpdate && (
        <aside className="pwa-update-banner" role="alert">
          <div className="pwa-update-content">
            <span className="pwa-update-icon">🚀</span>
            <span className="pwa-update-text">
              A new version of MatrixMixer (<strong>v{updateAvailable}</strong>) is available!
            </span>
          </div>
          <div className="pwa-update-actions">
            <button className="btn-pwa-update" onClick={handleForceUpdate}>
              🔄 Update Now
            </button>
            <button
              className="btn-pwa-dismiss"
              onClick={() => setDismissedUpdate(true)}
              title="Dismiss for now"
            >
              ✕
            </button>
          </div>
        </aside>
      )}

      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-top-row">
          <div className="nav-brand">
            <span className="brand-badge">LINE 6</span>
            <div className="brand-title">
              Helix Stadium 1.4
              <span className="brand-subtitle">
                Matrix Mixer <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '4px' }}>v{APP_VERSION}</span>
                {updateAvailable && (
                  <button
                    className="badge-update-available"
                    onClick={handleForceUpdate}
                    title={`New version v${updateAvailable} is available! Click to update now.`}
                  >
                    ⚡ Update to v{updateAvailable}
                  </button>
                )}
              </span>
            </div>
          </div>

          {/* Layer Switcher Tabs */}
          <div className="layer-tabs">
            <button
              className={`layer-tab ${activeLayerId === 'quarter_inch' ? 'active tab-blue' : ''}`}
              disabled={lockedLayer && activeLayerId !== 'quarter_inch'}
              onClick={() => setActiveLayerId('quarter_inch')}
            >
              <span className="tab-label-full">Matrix &gt; 1/4" Out</span>
              <span className="tab-label-short">1/4"</span>
              <span className="layer-channel-badge">Ch {layersData.quarter_inch.midiChannel}</span>
            </button>
            <button
              className={`layer-tab ${activeLayerId === 'xlr' ? 'active tab-green' : ''}`}
              disabled={lockedLayer && activeLayerId !== 'xlr'}
              onClick={() => setActiveLayerId('xlr')}
            >
              <span className="tab-label-full">Matrix &gt; XLR Out</span>
              <span className="tab-label-short">XLR</span>
              <span className="layer-channel-badge">Ch {layersData.xlr.midiChannel}</span>
            </button>
            <button
              className={`layer-tab ${activeLayerId === 'phones' ? 'active tab-amber' : ''}`}
              disabled={lockedLayer && activeLayerId !== 'phones'}
              onClick={() => setActiveLayerId('phones')}
            >
              <span className="tab-label-full">Matrix &gt; Phones Out</span>
              <span className="tab-label-short">Phones</span>
              <span className="layer-channel-badge">Ch {layersData.phones.midiChannel}</span>
            </button>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="nav-actions">
          {/* Showcase Stems Quick Action Button */}
          <button
            className="btn btn-showcase"
            onClick={handleApplyShowcaseStems}
            title="Line 6 Showcase: Apply standard stems (Drums, Bass, Piano, Guitar, Other, Vocals, Click, Cue)"
          >
            <span>🥁 Showcase Stems</span>
          </button>

          {/* Master Clear Solo (CC103) */}
          <button
            className={`btn btn-clear-solo ${hasActiveSolo ? 'active' : ''}`}
            onClick={() => handleClearSolo(true)}
            title="Helix Stadium CC103: Reset all Solos on this layer"
          >
            CLEAR SOLO
          </button>

          {/* Prominent MIDI Setup Button */}
          <button
            className="btn btn-midi"
            onClick={() => setShowMidiModal(true)}
            title="Configure MIDI ports, Helix USB relay & channels"
          >
            <span className="midi-dot online"></span>
            <span>🎛️ MIDI (Ch {currentLayerData?.midiChannel})</span>
          </button>

          {/* Presets */}
          <button className="btn" onClick={() => setShowPresetsModal(true)} title="Mix Scenes & Presets">
            💾 Presets
          </button>

          {/* Lock view to current layer */}
          <button
            className={`btn ${lockedLayer ? 'btn-primary' : ''}`}
            onClick={() => setLockedLayer(!lockedLayer)}
            title="Lock view to current layer (for musicians controlling their own monitor mix)"
          >
            {lockedLayer ? '🔒 Locked' : '🔓 Lock'}
          </button>

          {/* Docs & Scrum for desktop / tablet */}
          <button className="btn btn-secondary-action" onClick={() => setShowDocsModal(true)} title="Manuals & API Specs">
            📖 Docs
          </button>

          <button className="btn btn-secondary-action" onClick={() => setShowScrumModal(true)} title="GitHub Scrum Issue Reporter">
            🐞 Scrum
          </button>

          {/* User profile */}
          <button
            className="btn btn-secondary-action"
            style={{ borderColor: user ? '#10b981' : '#334155' }}
            onClick={() => setShowLoginModal(true)}
          >
            👤 {user ? user.name : 'Sign In'}
          </button>
        </div>
      </header>

      {/* Main Mixer Console with 19 Channels */}
      <MixerConsole
        channels={channels}
        channelStates={currentLayerData?.channels || {}}
        midiChannel={currentLayerData?.midiChannel || 3}
        onUpdateChannel={handleUpdateChannel}
        onSendMidi={handleSendMidi}
        onOpenRename={handleOpenRename}
      />

      {/* Interactive Track Rename & Showcase Stems Modal */}
      <TrackRenameModal
        isOpen={!!renameTarget}
        channel={renameTarget ? renameTarget.def : null}
        currentName={renameTarget ? renameTarget.currentName : ''}
        onClose={() => setRenameTarget(null)}
        onSave={handleSaveRename}
        onApplyShowcaseAll={handleApplyShowcaseStems}
      />

      {/* Modals */}
      <MidiSettingsModal
        isOpen={showMidiModal}
        onClose={() => setShowMidiModal(false)}
        midiChannels={{
          quarter_inch: layersData.quarter_inch.midiChannel,
          xlr: layersData.xlr.midiChannel,
          phones: layersData.phones.midiChannel
        }}
        onUpdateChannels={handleUpdateLayerChannels}
        recallScope={presetRecallScope}
        onUpdateRecallScope={handleUpdateRecallScope}
        activeLayerName={activeLayer.name}
      />

      <PresetsModal
        isOpen={showPresetsModal}
        onClose={() => setShowPresetsModal(false)}
        presets={presets}
        onLoadPreset={handleLoadPreset}
        onSavePreset={handleSavePreset}
        onUpdatePreset={handleUpdatePreset}
        onDeletePreset={handleDeletePreset}
        recallScope={presetRecallScope}
        onUpdateRecallScope={handleUpdateRecallScope}
        activeLayerName={activeLayer.name}
        onOverwritePreset={handleOverwritePreset}
      />

      <DocumentationModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
      />

      <ScrumIssueModal
        isOpen={showScrumModal}
        onClose={() => setShowScrumModal(false)}
      />

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(u) => setUser(u)}
        currentUser={user}
        onLogout={() => {
          localStorage.removeItem('matrix_mixer_user');
          setUser(null);
        }}
      />

      {/* Floating Top-Center Stage HUD Recall & Action Banner */}
      {toast && (
        <div
          className={`toast-hud-banner ${toast.type === 'recall' ? 'recall-hud' : 'general-hud'}`}
          role="alert"
        >
          <div className="toast-hud-icon">
            {toast.type === 'recall' ? '⚡' : '✅'}
          </div>
          <div className="toast-hud-content">
            <div className="toast-hud-header">
              <span className="toast-hud-title">{toast.title}</span>
              {toast.pc !== undefined && <span className="toast-hud-pc">PC {toast.pc}</span>}
              {toast.badge && <span className="toast-hud-badge">{toast.badge}</span>}
            </div>
            <div className="toast-hud-message">{toast.message}</div>
          </div>
          <button
            className="toast-hud-close"
            onClick={() => setToast(null)}
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};
