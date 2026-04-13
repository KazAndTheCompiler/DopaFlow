import { useEffect } from 'react';

import type { Badge } from '../../../../shared/types/gamification';

export interface AchievementToastProps {
  badge: Badge | null;
  onDismiss: () => void;
}

export function AchievementToast({ badge, onDismiss }: AchievementToastProps): JSX.Element | null {
  useEffect(() => {
    if (!badge) {
      return;
    }
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [badge, onDismiss]);
  if (!badge) {
    return null;
  }
  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 400 }}>
      <div
        onClick={onDismiss}
        style={{
          cursor: 'pointer',
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          borderRadius: 16,
          padding: '1rem 1.25rem',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem' }}>{badge.icon}</div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>Badge unlocked!</div>
          <div style={{ fontWeight: 700 }}>{badge.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {badge.description}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AchievementToast;
