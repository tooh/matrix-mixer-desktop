import React from 'react';
import { ChannelDefinition, ChannelState } from '../types';
import { ChannelStrip } from './ChannelStrip';

interface Props {
  channels: ChannelDefinition[];
  channelStates: Record<string, ChannelState>;
  midiChannel: number;
  isAllView?: boolean;
  channelDefaults?: Record<string, number>;
  onUpdateChannel: (channelId: string, updates: Partial<ChannelState>) => void;
  onSendMidi: (cc: number, value: number, desc?: string) => void;
  onOpenRename?: (def: ChannelDefinition, currentName: string) => void;
  onSetChannelDefault?: (channelId: string, level: number) => void;
}

export const MixerConsole: React.FC<Props> = ({
  channels,
  channelStates,
  midiChannel,
  isAllView = false,
  channelDefaults = {},
  onUpdateChannel,
  onSendMidi,
  onOpenRename,
  onSetChannelDefault
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // If not in All-view and not holding Shift, convert vertical mouse wheel scroll to horizontal scrolling
    if (!isAllView && e.deltaY !== 0 && containerRef.current && !e.shiftKey) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className={`mixer-container ${isAllView ? 'is-all-view' : ''}`} ref={containerRef} onWheel={handleWheel}>
      <div className={`mixer-console ${isAllView ? 'is-all-view' : ''}`}>
        {channels.map((def) => {
          const state = channelStates[def.id] || {
            level: def.defaultLevel,
            pan: def.defaultPan,
            mute: false,
            solo: false,
            name: def.name,
            isUnused: false
          };

          return (
            <ChannelStrip
              key={def.id}
              def={def}
              state={state}
              midiChannel={midiChannel}
              isCompact={isAllView}
              channelDefaultLevel={channelDefaults[def.id]}
              onUpdate={(updates) => onUpdateChannel(def.id, updates)}
              onSendMidi={onSendMidi}
              onOpenRename={onOpenRename}
              onSetDefaultLevel={(lvl) => onSetChannelDefault && onSetChannelDefault(def.id, lvl)}
            />
          );
        })}
      </div>
    </div>
  );
};
