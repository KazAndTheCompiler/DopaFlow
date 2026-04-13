import type { JSX } from 'react';

import { disabledBtn, ENERGY_LEVELS, primaryBtn } from './PlanMyDayShared';

export function EnergyCheck({
  energy,
  onPick,
  onNext,
}: {
  energy: number | null;
  onPick: (value: number) => void;
  onNext: () => void;
}): JSX.Element {
  return (
    <div>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          marginTop: 0,
          marginBottom: '1.25rem',
        }}
      >
        How's your energy right now?
      </p>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level.value}
            onClick={() => onPick(level.value)}
            style={{
              flex: 1,
              padding: '0.65rem 0.25rem',
              borderRadius: '12px',
              border: '1.5px solid',
              borderColor: energy === level.value ? 'var(--accent)' : 'var(--border-subtle)',
              background:
                energy === level.value
                  ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  : 'var(--surface-2)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'border-color 120ms, background 120ms',
            }}
          >
            <span
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                background:
                  energy === level.value
                    ? 'color-mix(in srgb, var(--accent) 15%, var(--surface))'
                    : 'var(--surface)',
                fontSize: '1.3rem',
                lineHeight: 1,
              }}
            >
              {level.code}
            </span>
            <span
              style={{
                fontSize: '10px',
                color: energy === level.value ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: energy === level.value ? 700 : 400,
              }}
            >
              {level.label}
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={energy === null}
        style={energy !== null ? primaryBtn : disabledBtn}
      >
        Continue
      </button>
    </div>
  );
}
