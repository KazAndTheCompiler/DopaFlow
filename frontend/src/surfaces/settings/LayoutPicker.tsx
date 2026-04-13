import type { LayoutMode } from '../../hooks/useLayout';

const OPTIONS: Array<{
  id: LayoutMode;
  label: string;
  description: string;
}> = [
  {
    id: 'compact',
    label: 'Compact',
    description: 'Tighter spacing for dense task and review work.',
  },
  {
    id: 'comfortable',
    label: 'Comfortable',
    description: 'Balanced spacing for everyday use.',
  },
  {
    id: 'expanded',
    label: 'Expanded',
    description: 'More breathing room for calmer reading and planning.',
  },
];

export function LayoutPicker({
  current,
  onPick,
}: {
  current: LayoutMode;
  onPick: (mode: LayoutMode) => void;
}): JSX.Element {
  return (
    <section
      style={{
        display: 'grid',
        gap: '0.8rem',
        padding: '1.1rem 1.25rem',
        borderRadius: '20px',
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <strong style={{ fontSize: 'var(--text-base)' }}>Layout density</strong>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Themes change mood. Layout changes how tight or roomy the whole app feels.
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.6rem',
        }}
      >
        {OPTIONS.map((option) => {
          const selected = option.id === current;
          return (
            <button
              key={option.id}
              onClick={() => onPick(option.id)}
              style={{
                padding: '0.85rem 0.9rem',
                borderRadius: '14px',
                border: selected ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                background: selected
                  ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))'
                  : 'var(--surface-2)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'grid',
                gap: '0.25rem',
                textAlign: 'left',
                boxShadow: selected
                  ? '0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent)'
                  : 'none',
              }}
            >
              <strong style={{ fontSize: 'var(--text-sm)' }}>{option.label}</strong>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default LayoutPicker;
