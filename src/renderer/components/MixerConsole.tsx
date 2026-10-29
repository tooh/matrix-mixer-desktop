import React from 'react';
import { ChannelDefinition, ChannelState } from '../types';
import { ChannelStrip } from './ChannelStrip';

interface Props {
  channels: ChannelDefinition[];
  channelStates: Record<string, ChannelState>;
  midiChannel: number;
  onUpdateChannel: (channelId: string, updates: Partial<ChannelState>) => void;
  onSendMidi: (cc: number, value: number, desc?: string) => void;
  onOpenRename?: (def: ChannelDefinition, currentName: string) => void;
}

export const MixerConsole: React.FC<Props> = ({
  channels,
  channelStates,
  midiChannel,
  onUpdateChannel,
  onSendMidi,
  onOpenRename
}) => {
  return (
    <div className="mixer-container">
      <div className="mixer-console">
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
              onUpdate={(updates) => onUpdateChannel(def.id, updates)}
              onSendMidi={onSendMidi}
              onOpenRename={onOpenRename}
            />
          );
        })}
      </div>
    </div>
  );
};
