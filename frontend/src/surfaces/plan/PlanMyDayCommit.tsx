import type { JSX } from 'react';

import type { Task } from '@shared/types';

import { ENERGY_LEVELS, ghostBtn, primaryBtn } from './PlanMyDayShared';

export function Commit({
  picks,
  tasks,
  whisper,
  energy,
  onStartTasks,
  onStartFocus,
  onBack,
}: {
  picks: Set<string>;
  tasks: Task[];
  whisper: string;
  energy: number | null;
  onStartTasks: () => void;
  onStartFocus: (taskTitle: string) => void;
  onBack: () => void;
}): JSX.Element {
  const pickedTasks = tasks.filter((task) => picks.has(task.id));
  const firstTask = pickedTasks[0];
  const energyLevel = energy !== null ? ENERGY_LEVELS[energy] : null;

  return (
    <div>
      {energyLevel && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          <span
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--surface-2)',
              fontSize: '1rem',
              lineHeight: 1,
            }}
          >
            {energyLevel.code}
          </span>
          <span>
            Starting at <strong style={{ color: 'var(--text)' }}>{energyLevel.label}</strong> energy
          </span>
        </div>
      )}

      {pickedTasks.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <span
            style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}
          >
            Today's commitments
          </span>
          {pickedTasks.map((task, index) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'center',
                padding: '0.6rem 0.85rem',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'var(--text-inverted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                {task.title}
              </span>
              {task.estimated_minutes != null && (
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  {task.estimated_minutes}m
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            marginBottom: '1.25rem',
          }}
        >
          Nothing picked — give yourself a break.
        </p>
      )}

      {whisper && (
        <div
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            marginBottom: '1.25rem',
          }}
        >
          Packy: {whisper}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
        {firstTask && (
          <button
            onClick={() => onStartFocus(firstTask.title)}
            style={{
              ...primaryBtn,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <span>⏱ Start focus on "{firstTask.title}"</span>
          </button>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onBack} style={ghostBtn}>
            Back
          </button>
          <button
            onClick={onStartTasks}
            style={{ ...ghostBtn, flex: 1, borderColor: 'var(--border)' }}
          >
            View tasks
          </button>
        </div>
      </div>
    </div>
  );
}
