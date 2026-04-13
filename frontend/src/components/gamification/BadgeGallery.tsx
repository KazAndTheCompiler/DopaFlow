import type { Badge } from '../../../../shared/types/gamification';
import BadgeCard from './BadgeCard';

export interface BadgeGalleryProps {
  badges: Badge[];
}

export function BadgeGallery({ badges }: BadgeGalleryProps): JSX.Element {
  const sorted = [...badges].sort(
    (left, right) =>
      Number(Boolean(right.earned_at)) - Number(Boolean(left.earned_at)) ||
      right.progress - left.progress,
  );
  const earned = badges.filter((badge) => badge.earned_at).length;
  return (
    <section>
      <div
        style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '0.5rem' }}
      >{`Achievements · ${earned}/${badges.length}`}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {sorted.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  );
}

export default BadgeGallery;
