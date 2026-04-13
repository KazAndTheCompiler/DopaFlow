import Button from './Button';

export interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: EmptyStateProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '2rem',
        background: 'var(--surface)',
        borderRadius: '20px',
        border: '1px solid var(--border-subtle)',
        textAlign: 'center',
        minHeight: '200px',
      }}
    >
      <div
        style={{
          minWidth: '56px',
          height: '56px',
          padding: '0 0.85rem',
          borderRadius: '18px',
          display: 'grid',
          placeItems: 'center',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          color: 'var(--accent)',
          fontSize: icon.length <= 3 ? '0.82rem' : '1.4rem',
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: icon.length <= 3 ? '0.04em' : undefined,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{subtitle}</div>
      )}
      {ctaLabel && onCta && (
        <Button onClick={onCta} variant="primary" style={{ marginTop: '0.5rem' }}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
