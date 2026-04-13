import { useState } from 'react';

import type { Alarm } from '../../../../shared/types';
import AlarmAudioPlayer from '../../components/AlarmAudioPlayer';

interface AlarmQueueProps {
  alarms: Alarm[];
  activeAlarmId?: string | null | undefined;
  onTrigger: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const KIND_ICON: Record<string, string> = {
  tts: 'AU',
  youtube: 'YT',
  silent: 'SL',
};

function formatAlarmTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  const sameDay = d.toDateString() === now.toDateString();
  const nextDay = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) {
    return `Today ${time}`;
  }
  if (nextDay) {
    return `Tomorrow ${time}`;
  }
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

function isPast(iso: string): boolean {
  return new Date(iso) < new Date();
}

export function AlarmQueue({
  alarms,
  activeAlarmId,
  onTrigger,
  onDelete,
}: AlarmQueueProps): JSX.Element {
  const [justFiredId, setJustFiredId] = useState<string | null>(null);

  if (alarms.length === 0) {
    return (
      <section
        style={{
          padding: '1.5rem',
          background: 'var(--surface)',
          borderRadius: '18px',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        No alarms scheduled.
      </section>
    );
  }

  const sorted = [...alarms].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <section
      style={{
        background: 'var(--surface)',
        borderRadius: '18px',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {sorted.map((alarm, i) => {
        const active = alarm.id === activeAlarmId;
        const past = isPast(alarm.at);

        return (
          <div
            key={alarm.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderBottom: i < sorted.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              background: active
                ? 'color-mix(in srgb, var(--accent) 8%, transparent)'
                : 'transparent',
              opacity: past && !active ? 0.55 : 1,
            }}
          >
            <span style={{ fontSize: '1.1rem', width: '1.4rem', textAlign: 'center' }}>
              {KIND_ICON[alarm.kind] ?? 'AL'}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: active ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                {alarm.title}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginTop: '0.1rem',
                }}
              >
                {formatAlarmTime(alarm.at)}
                {alarm.last_fired_at && (
                  <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                    · fired{' '}
                    {new Date(alarm.last_fired_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              {alarm.tts_text && (
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    marginTop: '0.15rem',
                  }}
                >
                  "{alarm.tts_text}"
                </div>
              )}
              {alarm.youtube_link ? (
                <AlarmAudioPlayer
                  youtubeUrl={alarm.youtube_link}
                  autoPlay={active || justFiredId === alarm.id}
                />
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              <button
                onClick={() => {
                  setJustFiredId(alarm.id);
                  void onTrigger(alarm.id);
                }}
                title="Fire now"
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '7px',
                  border: '1px solid var(--accent)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Fire
              </button>
              <button
                onClick={() => void onDelete(alarm.id)}
                title="Delete alarm"
                style={{
                  padding: '0.3rem 0.55rem',
                  borderRadius: '7px',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                X
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default AlarmQueue;
