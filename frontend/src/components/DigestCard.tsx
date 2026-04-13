import { Skeleton } from '../design-system/primitives/Skeleton';

interface DigestData {
  score: number;
  momentum_score: number;
  momentum_label: string;
  tasks: { completed: number; completion_rate: number };
  habits: { overall_rate: number };
  focus: { total_minutes: number };
}

export default function DigestCard({ digest }: { digest: DigestData }): JSX.Element {
  return (
    <div
      style={{
        padding: '1rem',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}
      >{`Daily Score: ${digest.score}`}</div>
      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        {`Momentum: `}
        <strong>{digest.momentum_label}</strong>
        {` (`}
        {digest.momentum_score === 0 ? (
          <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
            <Skeleton width="32px" height="16px" borderRadius="8px" />
          </span>
        ) : (
          `${(digest.momentum_score * 100).toFixed(0)}%`
        )}
        {`)`}
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.5rem',
        }}
      >
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Tasks</div>
          <div>{`${digest.tasks.completed} done (${digest.tasks.completion_rate.toFixed(0)}%)`}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Habits</div>
          <div>{`${digest.habits.overall_rate.toFixed(0)}%`}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Focus</div>
          <div>{`${digest.focus.total_minutes}m`}</div>
        </div>
      </div>
    </div>
  );
}
