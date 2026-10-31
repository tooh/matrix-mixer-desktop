import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ChannelDefinition, LayerConfig, LayerState, Preset, UserSession } from '../types';
import { apiRequest } from '../api';
import { MIDI } from '../midiService';
import { MixerConsole } from './MixerConsole';
import { levelToDb } from './ChannelStrip';
import { MidiSettingsModal } from './MidiSettingsModal';
import { PresetsModal } from './PresetsModal';
import { DocumentationModal } from './DocumentationModal';
import { ScrumIssueModal } from './ScrumIssueModal';
import { LoginModal } from './LoginModal';
import { TrackRenameModal } from './TrackRenameModal';
import { StageWifiModal } from './StageWifiModal';

declare const __APP_VERSION__: string;
const APP_VERSION = '1.9.0';

export type ChannelBankId = 'stems' | 'all' | 'paths' | 'aux' | 'vocal' | 'rhythm';

interface BankDefinition {
  label: string;
  count: number;
  channelIds?: string[];
}

const BANK_DEFINITIONS: Record<ChannelBankId, BankDefinition> = {
  stems: {
    label: '🥁 Band Stems',
    count: 9,
    channelIds: ['song', 'track_1', 'track_2', 'track_3', 'track_4', 'track_5', 'track_6', 'track_7', 'track_8']
  },
  all: {
    label: '🌐 All',
    count: 19
  },
  paths: {
    label: '🎸 Helix Paths',
    count: 5,
    channelIds: ['home', 'path_1a', 'path_1b', 'path_1c', 'path_1d']
  },
  aux: {
    label: '📱 Inputs & Aux',
    count: 5,
    channelIds: ['usb_1_2', 'bluetooth', 'aux_in', 'click', 'count_in']
  },
  vocal: {
    label: '🎤 Vocalist',
    count: 4,
    channelIds: ['track_6', 'song', 'track_7', 'track_8']
  },
  rhythm: {
    label: '🥁 Rhythm',
    count: 5,
    channelIds: ['track_1', 'track_2', 'track_7', 'track_8', 'song']
  }
};

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
  const [activeLayerId, setActiveLayerId] = useState<'quarter_inch' | 'xlr' | 'phones'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const l = params.get('layer');
      if (l === 'quarter_inch' || l === 'xlr' || l === 'phones') return l;
      const r = params.get('role');
      if (r === 'band' || r === 'iem') return 'phones';
      if (r === 'admin') return 'quarter_inch';
    }
    return 'xlr';
  });
  
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

  // Channel Banks & Filter Views (Default: Band Stems)
  const [activeBank, setActiveBank] = useState<ChannelBankId>(() => {
    return (localStorage.getItem('matrix_active_bank') as ChannelBankId) || 'stems';
  });
  const [hideUnused, setHideUnused] = useState<boolean>(() => {
    return localStorage.getItem('matrix_hide_unused') === 'true';
  });

  // Custom channel default levels (default is 100 / 0.0 dB if not customized)
  const [channelDefaults, setChannelDefaults] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('matrix_channel_defaults');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleSetChannelDefault = (channelId: string, level: number) => {
    setChannelDefaults((prev) => {
      const next = { ...prev, [channelId]: level };
      localStorage.setItem('matrix_channel_defaults', JSON.stringify(next));
      return next;
    });
    const chDef = channels.find((c) => c.id === channelId);
    const chName = layersData[activeLayerId]?.channels[channelId]?.name || chDef?.name || channelId;
    triggerToast(`📍 Default fader voor "${chName}" ingesteld op ${levelToDb(level)}`);
  };

  const handleSelectBank = (bank: ChannelBankId) => {
    setActiveBank(bank);
    localStorage.setItem('matrix_active_bank', bank);
  };

  const handleToggleHideUnused = () => {
    const next = !hideUnused;
    setHideUnused(next);
    localStorage.setItem('matrix_hide_unused', String(next));
  };

  // Modals
  const [showMidiModal, setShowMidiModal] = useState<boolean>(false);
  const [showPresetsModal, setShowPresetsModal] = useState<boolean>(false);
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [showScrumModal, setShowScrumModal] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showWifiModal, setShowWifiModal] = useState<boolean>(false);
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

    // 4. Check stored user or URL override (?role=admin | operator | band)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get('role');
      if (roleParam === 'admin') {
        const u: UserSession = { id: 'usr-admin', name: 'System Administrator', role: 'ADMIN' };
        setUser(u);
        localStorage.setItem('matrix_mixer_user', JSON.stringify(u));
      } else if (roleParam === 'operator' || roleParam === 'foh') {
        const u: UserSession = { id: 'usr-foh', name: 'FOH Sound Engineer', role: 'OPERATOR' };
        setUser(u);
        localStorage.setItem('matrix_mixer_user', JSON.stringify(u));
      } else if (roleParam === 'band' || roleParam === 'iem') {
        const u: UserSession = { id: 'usr-band', name: 'Band Member (IEM)', role: 'BAND_MEMBER' };
        setUser(u);
        localStorage.setItem('matrix_mixer_user', JSON.stringify(u));
      } else {
        const savedUser = localStorage.getItem('matrix_mixer_user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {}
        }
      }
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

  const isAdmin = user?.role === 'ADMIN';
  const isOperator = user?.role === 'OPERATOR';
  const isBandMember = user?.role === 'BAND_MEMBER';
  const isGuest = !user;

  // Auto-switch to Phones layer when user is BAND_MEMBER
  useEffect(() => {
    if (user?.role === 'BAND_MEMBER' && activeLayerId !== 'phones') {
      setActiveLayerId('phones');
    }
  }, [user?.role, activeLayerId]);

  // Send MIDI CC
  const handleSendMidi = useCallback((cc: number, value: number, desc?: string) => {
    if (!user) {
      triggerToast('⚠️ Please sign in to control mixer levels.');
      setShowLoginModal(true);
      return;
    }
    if (user.role === 'BAND_MEMBER' && activeLayerId !== 'phones') {
      triggerToast('⚠️ Access Denied: Band Member role is restricted to Phones (IEM) mix.');
      return;
    }
    MIDI.sendCC(currentLayerData.midiChannel, cc, value, desc);
  }, [user, activeLayerId, currentLayerData.midiChannel]);

  // Update a single channel
  const handleUpdateChannel = (channelId: string, updates: Partial<any>) => {
    if (!user) {
      triggerToast('⚠️ Please sign in to adjust faders or mutes.');
      setShowLoginModal(true);
      return;
    }
    if (user.role === 'BAND_MEMBER' && activeLayerId !== 'phones') {
      triggerToast('⚠️ Access Denied: Band Member role is restricted to Phones (IEM) mix.');
      return;
    }
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
    if (isGuest || isBandMember) {
      triggerToast('⚠️ Channel renaming requires an OPERATOR or ADMIN role.');
      return;
    }
    setRenameTarget({ def, currentName });
  };

  const handleSaveRename = (channelId: string, newName: string, allLayers: boolean) => {
    if (isGuest || isBandMember) {
      triggerToast('⚠️ Channel renaming requires an OPERATOR or ADMIN role.');
      return;
    }
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
    if (isGuest || isBandMember) {
      triggerToast('⚠️ Applying showcase stems requires an OPERATOR or ADMIN role.');
      return;
    }
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
    if (!user) {
      triggerToast('⚠️ Please sign in to clear solos.');
      setShowLoginModal(true);
      return;
    }
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
    if (!isAdmin) {
      triggerToast('⚠️ Modifying MIDI layer channels requires Administrator permissions.');
      return;
    }
    setLayersData((prev) => ({
      ...prev,
      quarter_inch: { ...prev.quarter_inch, midiChannel: newChannels.quarter_inch },
      xlr: { ...prev.xlr, midiChannel: newChannels.xlr },
      phones: { ...prev.phones, midiChannel: newChannels.phones }
    }));
  };

  // Load Preset
  const handleLoadPreset = (preset: Preset) => {
    if (isGuest) {
      triggerToast('⚠️ Please sign in to recall presets.');
      setShowLoginModal(true);
      return;
    }

    const storedScope = localStorage.getItem('matrix_preset_recall_scope');
    const currentScope = (storedScope as 'active_layer' | 'all_layers') || presetRecallScopeRef.current || 'active_layer';
    const isAllLayers = currentScope === 'all_layers' && !isBandMember;
    const currentActiveLayer = isBandMember ? 'phones' : (activeLayerIdRef.current || activeLayerId);

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
    if (isGuest || isBandMember) {
      triggerToast('⚠️ Saving presets requires an OPERATOR or ADMIN role.');
      return;
    }
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
    if (isGuest || isBandMember) {
      triggerToast('⚠️ Editing presets requires an OPERATOR or ADMIN role.');
      return;
    }
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
    if (isGuest || isBandMember) {
      triggerToast('⚠️ Overwriting presets requires an OPERATOR or ADMIN role.');
      return;
    }
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
    if (!isAdmin) {
      triggerToast('⚠️ Deleting presets is restricted to Administrator role.');
      return;
    }
    try {
      await apiRequest(`/api/presets/${id}`, { method: 'DELETE' });
      setPresets((prev) => prev.filter((p) => p.id !== id));
      triggerToast('Preset deleted');
    } catch (err: any) {
      alert(`Error deleting preset: ${err.message}`);
    }
  };

  // Filter channels according to active bank and unused toggle
  const currentChannelsState = layersData[activeLayerId]?.channels || {};
  const currentBankDef = BANK_DEFINITIONS[activeBank] || BANK_DEFINITIONS.stems;

  const filteredChannels = channels.filter((ch) => {
    if (currentBankDef.channelIds && !currentBankDef.channelIds.includes(ch.id)) {
      return false;
    }
    if (hideUnused) {
      const st = currentChannelsState[ch.id];
      if (st && st.isUnused) return false;
    }
    return true;
  });

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
            <div className="brand-title" style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center' }}>
              Matrix Mixer <span className="version-pill">v{APP_VERSION}</span>
              {updateAvailable && (
                <button
                  className="badge-update-available"
                  onClick={handleForceUpdate}
                  title={`New version v${updateAvailable} is available! Click to update now.`}
                >
                  ⚡ Update to v{updateAvailable}
                </button>
              )}
            </div>
          </div>

          {/* Layer Switcher Tabs */}
          <div className="layer-tabs">
            <button
              className={`layer-tab ${activeLayerId === 'quarter_inch' ? 'active tab-blue' : ''}`}
              disabled={(lockedLayer && activeLayerId !== 'quarter_inch') || isBandMember}
              onClick={() => setActiveLayerId('quarter_inch')}
              title={isBandMember ? 'Restricted: Band Member role is limited to Phones (IEM) output' : undefined}
            >
              <span className="tab-label-full">Matrix &gt; 1/4" Out</span>
              <span className="tab-label-short">1/4"</span>
              <span className="layer-channel-badge">Ch {layersData.quarter_inch.midiChannel}</span>
            </button>
            <button
              className={`layer-tab ${activeLayerId === 'xlr' ? 'active tab-green' : ''}`}
              disabled={(lockedLayer && activeLayerId !== 'xlr') || isBandMember}
              onClick={() => setActiveLayerId('xlr')}
              title={isBandMember ? 'Restricted: Band Member role is limited to Phones (IEM) output' : undefined}
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
            {isBandMember && (
              <span style={{
                fontSize: '11px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#fbbf24',
                border: '1px solid #f59e0b',
                padding: '3px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                alignSelf: 'center',
                marginLeft: '4px'
              }}>
                🎧 In-Ear Mode (Locked)
              </span>
            )}
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

          {/* Stage Wi-Fi Remote & QR Hub */}
          <button
            className="btn btn-wifi"
            onClick={() => setShowWifiModal(true)}
            title="Stage Wi-Fi Remote & iPad / iPhone QR Code"
          >
            <span>📱 Stage Wi-Fi / QR</span>
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

          {/* User profile with RBAC badge */}
          <button
            className="btn btn-secondary-action"
            style={{
              borderColor: user ? (isAdmin ? '#ef4444' : isOperator ? '#38bdf8' : '#f59e0b') : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setShowLoginModal(true)}
            title={user ? `Signed in as ${user.name} (${user.role})` : 'Sign in to unlock mixer control'}
          >
            <span>👤 {user ? user.name : 'Sign In'}</span>
            <span style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '4px',
              fontWeight: 700,
              background: isAdmin ? '#ef4444' : isOperator ? '#0284c7' : isBandMember ? '#d97706' : '#334155',
              color: '#ffffff'
            }}>
              {user ? user.role : 'VIEW ONLY'}
            </span>
          </button>
        </div>
      </header>

      {/* Channel Bank & Filter Sub-selection Bar */}
      <div className="bank-bar">
        <div className="bank-pills">
          <button
            className={`bank-pill ${activeBank === 'stems' ? 'active' : ''}`}
            onClick={() => handleSelectBank('stems')}
            title="Band Showcase Stems (Song + Drums, Bass, Piano, Guitar, Other, Vocals, Click, Cue)"
          >
            <span>🥁 Band Stems</span>
            <span className="bank-count">9</span>
          </button>
          <button
            className={`bank-pill ${activeBank === 'all' ? 'active' : ''}`}
            onClick={() => handleSelectBank('all')}
            title="Show All 19 Matrix Mixer Channels"
          >
            <span>🌐 All</span>
            <span className="bank-count">19</span>
          </button>
          <button
            className={`bank-pill ${activeBank === 'paths' ? 'active' : ''}`}
            onClick={() => handleSelectBank('paths')}
            title="Helix DSP Paths (Home Master + Paths 1A-1D)"
          >
            <span>🎸 Helix Paths</span>
            <span className="bank-count">5</span>
          </button>
          <button
            className={`bank-pill ${activeBank === 'aux' ? 'active' : ''}`}
            onClick={() => handleSelectBank('aux')}
            title="Inputs & Utility (USB, Bluetooth, Aux In, Click, Count In)"
          >
            <span>📱 Inputs & Aux</span>
            <span className="bank-count">5</span>
          </button>

          <span className="bank-divider"></span>

          <button
            className={`bank-pill ${activeBank === 'vocal' ? 'active' : ''}`}
            onClick={() => handleSelectBank('vocal')}
            title="Vocalist In-Ear Mix (Vocals, Band Stems, Click, Cue)"
          >
            <span>🎤 Vocalist</span>
            <span className="bank-count">4</span>
          </button>
          <button
            className={`bank-pill ${activeBank === 'rhythm' ? 'active' : ''}`}
            onClick={() => handleSelectBank('rhythm')}
            title="Rhythm Section In-Ear Mix (Drums, Bass, Click, Cue, Band)"
          >
            <span>🥁 Rhythm</span>
            <span className="bank-count">5</span>
          </button>
        </div>

        <div className="bank-tools">
          <button
            className={`btn-toggle-unused ${hideUnused ? 'active' : ''}`}
            onClick={handleToggleHideUnused}
            title="Toggle hiding channels marked as unused"
          >
            {hideUnused ? '👁️‍🗨️ Hiding Unused' : '👁️ Hide Unused'}
          </button>
          <span className="visible-count-text">
            {filteredChannels.length} of {channels.length} faders
          </span>
        </div>
      </div>

      {/* RBAC Status & Awareness Notice */}
      {!user && (
        <aside style={{
          background: 'rgba(30, 41, 59, 0.85)',
          borderBottom: '1px solid #334155',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#cbd5e1'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>👁️</span>
            <span><strong>View-Only Mode:</strong> Sign in as FOH Operator, Band Member, or Admin to control faders, mute/solo, and recall presets.</span>
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '2px 10px', fontSize: '11px' }}
            onClick={() => setShowLoginModal(true)}
          >
            Sign In
          </button>
        </aside>
      )}
      {isBandMember && (
        <aside style={{
          background: 'rgba(245, 158, 11, 0.12)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#fde68a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎧</span>
            <span><strong>Band Member In-Ear Monitor Mode:</strong> You have control over Matrix &gt; Phones Out. Other layers are locked.</span>
          </div>
          <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>MIDI Ch {layersData.phones.midiChannel}</span>
        </aside>
      )}

      {/* Main Mixer Console with Active Bank Channels */}
      <MixerConsole
        channels={filteredChannels}
        channelStates={currentLayerData?.channels || {}}
        midiChannel={currentLayerData?.midiChannel || 3}
        isAllView={activeBank === 'all'}
        channelDefaults={channelDefaults}
        onUpdateChannel={handleUpdateChannel}
        onSendMidi={handleSendMidi}
        onOpenRename={handleOpenRename}
        onSetChannelDefault={handleSetChannelDefault}
      />

      {/* Interactive Track Rename & Showcase Stems Modal */}
      <TrackRenameModal
        isOpen={!!renameTarget}
        channel={renameTarget ? renameTarget.def : null}
        currentName={renameTarget ? renameTarget.currentName : ''}
        currentLevel={renameTarget ? (currentChannelsState[renameTarget.def.id]?.level ?? 100) : 100}
        channelDefaultLevel={renameTarget ? (channelDefaults[renameTarget.def.id] ?? 100) : 100}
        onClose={() => setRenameTarget(null)}
        onSave={handleSaveRename}
        onApplyShowcaseAll={handleApplyShowcaseStems}
        onSetDefaultLevel={handleSetChannelDefault}
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
        isAdmin={isAdmin}
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
        canManagePresets={isAdmin || isOperator}
        canDeletePresets={isAdmin}
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

      <StageWifiModal
        isOpen={showWifiModal}
        onClose={() => setShowWifiModal(false)}
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
