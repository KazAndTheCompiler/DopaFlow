export interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md';
}

export function LevelBadge({ level, size = 'md' }: LevelBadgeProps): JSX.Element {
  return (
    <div
      style={{
        width: size === 'sm' ? 28 : 40,
        height: size === 'sm' ? 28 : 40,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
        color: 'white',
        fontWeight: 700,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {level}
    </div>
  );
}

export default LevelBadge;
