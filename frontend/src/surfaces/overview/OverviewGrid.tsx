import type { CSSProperties } from 'react';

export interface OverviewGridProps {
  momentum?: number | null | undefined;
  moodCorrelations?: Array<{ habit: string; correlation: number }> | undefined;
  weeklyDigest?: { title: string; highlights: string[] } | undefined;
  graphNodes?: Array<{ id: string; label: string; links: number }> | undefined;
}

export default function OverviewGrid(props: OverviewGridProps): JSX.Element {
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  };

  const cardStyle: CSSProperties = {
    padding: '1.25rem',
    borderRadius: '16px',
    background: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    display: 'grid',
    gap: '0.5rem',
  };

  const labelStyle: CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const valueStyle: CSSProperties = {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--accent)',
  };

  return (
    <div style={gridStyle}>
      <div style={cardStyle}>
        <div style={labelStyle}>Momentum</div>
        <div style={valueStyle}>
          {props.momentum !== null && props.momentum !== undefined
            ? Math.round(props.momentum)
            : '—'}
        </div>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Focus + completion velocity
        </span>
      </div>

      {props.weeklyDigest && (
        <div style={cardStyle}>
          <div style={labelStyle}>This week</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{props.weeklyDigest.title}</div>
          <span
            style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}
          >
            {props.weeklyDigest.highlights[0] ?? 'No weekly summary available yet.'}
          </span>
        </div>
      )}

      {props.moodCorrelations && props.moodCorrelations.length > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>Mood drivers</div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {props.moodCorrelations.slice(0, 3).map((corr) => (
              <div
                key={corr.habit}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 'var(--text-sm)' }}>{corr.habit}</span>
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: corr.correlation > 0 ? 'var(--state-ok)' : 'var(--state-overdue)',
                  }}
                >
                  {(corr.correlation * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {props.graphNodes && props.graphNodes.length > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>Most linked</div>
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            {props.graphNodes.slice(0, 5).map((node) => (
              <div
                key={node.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span>{node.label}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{node.links} links</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
