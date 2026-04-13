export function SidebarFooter({
  collapsed,
  habitPips,
  streakCount,
  momentumScore,
}: {
  collapsed: boolean;
  habitPips: number;
  streakCount: number;
  momentumScore?: number | undefined;
}): JSX.Element {
  return collapsed ? (
    <>
      {momentumScore !== undefined && (
        <div
          style={{
            textAlign: 'center',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)' }}>
            {Math.round(momentumScore)}
          </span>
        </div>
      )}
    </>
  ) : (
    <div
      style={{
        padding: '0.85rem 0.5rem 0',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: '0.75rem',
        display: 'grid',
        gap: '0.7rem',
      }}
    >
      <div
        style={{
          padding: '0.8rem 0.85rem',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          background: 'color-mix(in srgb, var(--surface) 76%, white 24%)',
          display: 'grid',
          gap: '0.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.6rem',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
            }}
          >
            Habit rhythm
          </span>
          <span
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 700 }}
          >
            {habitPips}/5
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '999px',
                background:
                  i < habitPips
                    ? 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 78%, white 22%), var(--accent))'
                    : 'var(--border)',
                transition: 'background 200ms ease',
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            background: 'var(--surface-2)',
          }}
        >
          Streak {streakCount}
        </span>
        {momentumScore !== undefined && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              background: 'var(--accent)22',
              color: 'var(--accent)',
            }}
          >
            Momentum {Math.round(momentumScore)}
          </span>
        )}
      </div>
    </div>
  );
}
