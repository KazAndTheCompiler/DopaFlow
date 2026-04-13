import type { CSSProperties } from 'react';

const shimmerStyle: CSSProperties = {
  background:
    'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
};

const styles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

// Inject keyframe animation into document once.
if (typeof document !== 'undefined' && !document.getElementById('dopaflow-skeleton-styles')) {
  const style = document.createElement('style');
  style.id = 'dopaflow-skeleton-styles';
  style.innerHTML = styles;
  document.head.appendChild(style);
}

export interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
}

export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
}: SkeletonProps): JSX.Element {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        ...shimmerStyle,
      }}
    />
  );
}

export interface SkeletonCardProps {
  height?: string;
}

export function SkeletonCard({ height = '80px' }: SkeletonCardProps): JSX.Element {
  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: '18px',
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      <Skeleton height="20px" borderRadius="10px" />
      <Skeleton height="16px" width="80%" borderRadius="8px" />
      <Skeleton height={height} borderRadius="10px" />
    </div>
  );
}

export interface SkeletonListProps {
  rows?: number;
  showAvatar?: boolean;
}

export function SkeletonList({ rows = 5, showAvatar = false }: SkeletonListProps): JSX.Element {
  return (
    <section
      style={{
        padding: '0.75rem 1rem',
        borderRadius: '18px',
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '0.75rem 0.5rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {showAvatar && <Skeleton width="32px" height="32px" borderRadius="50%" />}
          <div style={{ flex: 1, display: 'grid', gap: '0.4rem' }}>
            <Skeleton height="16px" width="70%" borderRadius="6px" />
            <Skeleton height="12px" width="50%" borderRadius="6px" />
          </div>
        </div>
      ))}
    </section>
  );
}

export interface SkeletonStatRowProps {}

export function SkeletonStatRow({}: SkeletonStatRowProps): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem',
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '1.25rem',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <Skeleton height="12px" width="60%" borderRadius="6px" />
          <Skeleton height="32px" width="85%" borderRadius="8px" />
          <Skeleton height="12px" width="70%" borderRadius="6px" />
        </div>
      ))}
    </div>
  );
}

function SkeletonPanel({
  children,
  gap = '0.75rem',
  padding = '1rem',
}: {
  children: React.ReactNode;
  gap?: string;
  padding?: string;
}): JSX.Element {
  return (
    <section
      style={{
        padding,
        borderRadius: '20px',
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        gap,
      }}
    >
      {children}
    </section>
  );
}

export function TodaySurfaceSkeleton(): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'minmax(0, 1.9fr) minmax(300px, 0.95fr)',
        alignItems: 'start',
      }}
    >
      <section style={{ display: 'grid', gap: '1rem' }}>
        <SkeletonPanel>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'grid', gap: '0.45rem', minWidth: '220px' }}>
              <Skeleton width="88px" height="24px" borderRadius="8px" />
              <Skeleton width="180px" height="16px" />
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <Skeleton width="82px" height="36px" borderRadius="10px" />
              <Skeleton width="72px" height="36px" borderRadius="10px" />
              <Skeleton width="82px" height="36px" borderRadius="10px" />
            </div>
          </div>
        </SkeletonPanel>

        <SkeletonPanel padding="1.1rem 1.15rem">
          <Skeleton width="90px" height="12px" />
          <Skeleton width="58%" height="28px" borderRadius="10px" />
          <Skeleton width="92%" height="16px" />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
            <Skeleton width="110px" height="40px" borderRadius="10px" />
            <Skeleton width="126px" height="40px" borderRadius="10px" />
          </div>
          <SkeletonStatRow />
        </SkeletonPanel>

        <SkeletonPanel padding="1.1rem 1.15rem">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Skeleton width="110px" height="20px" borderRadius="8px" />
            <Skeleton width="28px" height="20px" borderRadius="999px" />
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.65rem 0.8rem',
                borderRadius: '14px',
                background: 'var(--surface-2)',
              }}
            >
              <Skeleton width="8px" height="8px" borderRadius="999px" />
              <div style={{ flex: 1, display: 'grid', gap: '0.3rem' }}>
                <Skeleton width={index === 0 ? '46%' : '62%'} height="14px" />
                <Skeleton width="24%" height="12px" />
              </div>
              <Skeleton width="76px" height="32px" borderRadius="8px" />
            </div>
          ))}
        </SkeletonPanel>

        <SkeletonPanel>
          <Skeleton width="140px" height="20px" borderRadius="8px" />
          <Skeleton height="180px" borderRadius="16px" />
        </SkeletonPanel>
      </section>

      <aside
        style={{
          display: 'grid',
          gap: '1rem',
          alignContent: 'start',
          gridTemplateColumns: 'minmax(0, 1fr)',
        }}
      >
        <SkeletonPanel padding="1.1rem 1.15rem">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Skeleton width="90px" height="20px" borderRadius="8px" />
            <Skeleton width="24px" height="20px" borderRadius="999px" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '12px',
                background: 'var(--surface-2)',
              }}
            >
              <Skeleton width="8px" height="8px" borderRadius="999px" />
              <div style={{ flex: 1, display: 'grid', gap: '0.3rem' }}>
                <Skeleton width={index % 2 === 0 ? '60%' : '72%'} height="14px" />
                <Skeleton width="20%" height="12px" />
              </div>
              <Skeleton width="28px" height="28px" borderRadius="8px" />
            </div>
          ))}
        </SkeletonPanel>

        <SkeletonList rows={3} showAvatar />

        <SkeletonPanel padding="1.1rem 1.15rem">
          <Skeleton width="120px" height="18px" borderRadius="8px" />
          <Skeleton width="86%" height="14px" />
          <Skeleton width="92%" height="14px" />
          <Skeleton width="74%" height="14px" />
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.4rem' }}>
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} style={{ display: 'grid', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <Skeleton width="38%" height="12px" />
                  <Skeleton width="42px" height="12px" />
                </div>
                <Skeleton height="4px" borderRadius="999px" />
              </div>
            ))}
          </div>
        </SkeletonPanel>
      </aside>
    </div>
  );
}

export function OverviewSurfaceSkeleton(): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <SkeletonPanel padding="1.15rem 1.25rem">
        <Skeleton width="84px" height="12px" />
        <Skeleton width="52%" height="26px" borderRadius="10px" />
        <Skeleton width="90%" height="16px" />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
          <Skeleton width="100px" height="40px" borderRadius="10px" />
          <Skeleton width="118px" height="40px" borderRadius="10px" />
        </div>
        <SkeletonStatRow />
      </SkeletonPanel>

      <SkeletonStatRow />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        <SkeletonCard height="130px" />
        <SkeletonCard height="130px" />
        <SkeletonCard height="130px" />
      </div>
    </div>
  );
}

export function GoalsSurfaceSkeleton(): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <SkeletonPanel padding="1.25rem">
        <Skeleton width="98px" height="22px" borderRadius="8px" />
        <Skeleton width="100%" height="42px" borderRadius="10px" />
        <Skeleton width="100%" height="84px" borderRadius="12px" />
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1rem' }}>
          <Skeleton width="100%" height="42px" borderRadius="10px" />
          <Skeleton width="100%" height="84px" borderRadius="12px" />
        </div>
        <Skeleton width="128px" height="40px" borderRadius="10px" />
      </SkeletonPanel>
      <SkeletonCard height="72px" />
      <SkeletonCard height="72px" />
      <SkeletonCard height="72px" />
    </div>
  );
}

export function ReviewSurfaceSkeleton(): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}
    >
      <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
        <SkeletonStatRow />
        <SkeletonCard height="260px" />
      </div>
      <SkeletonPanel padding="1.25rem">
        <Skeleton width="110px" height="18px" borderRadius="8px" />
        <SkeletonList rows={4} />
      </SkeletonPanel>
    </div>
  );
}

export function JournalSurfaceSkeleton(): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'minmax(200px, 240px) minmax(0, 1fr)',
      }}
    >
      <SkeletonList rows={5} />
      <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
          <Skeleton width="108px" height="38px" borderRadius="10px" />
          <Skeleton width="102px" height="38px" borderRadius="10px" />
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            padding: '0.3rem',
            background: 'var(--surface)',
            borderRadius: '12px',
            width: 'fit-content',
          }}
        >
          <Skeleton width="72px" height="34px" borderRadius="8px" />
          <Skeleton width="68px" height="34px" borderRadius="8px" />
          <Skeleton width="86px" height="34px" borderRadius="8px" />
        </div>
        <SkeletonCard height="360px" />
      </div>
    </div>
  );
}
