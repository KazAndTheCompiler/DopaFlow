import type { Badge } from '../../../../shared/types/gamification';

export interface BadgeCardProps {
  badge: Badge;
}

export function BadgeCard({ badge }: BadgeCardProps): JSX.Element {
  const earned = Boolean(badge.earned_at);
  return (
    <div
      style={{
        width: 80,
        height: 80,
        padding: '0.5rem',
        borderRadius: 14,
        background: earned ? 'var(--surface-2)' : 'var(--surface)',
        border: earned ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)',
        opacity: earned ? 1 : 0.45,
        display: 'grid',
        alignContent: 'space-between',
      }}
    >
      <div style={{ fontSize: '2rem', display: 'block', textAlign: 'center', lineHeight: 1 }}>
        {badge.icon}
      </div>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {badge.name}
      </div>
      {!earned ? (
        <div
          style={{ width: '100%', height: 3, background: 'var(--border-subtle)', borderRadius: 3 }}
        >
          <div
            style={{
              width: `${badge.progress * 100}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 3,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default BadgeCard;
