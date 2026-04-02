export interface XPBarProps {
  totalXp: number;
  level: number;
  progress: number;
  xpToNext: number;
}

export function XPBar({ totalXp, level, progress, xpToNext }: XPBarProps): JSX.Element {
  return (
    <div style={{ minWidth: 180 }}>
      <div style={{ width: "100%", height: 6, background: "var(--border-subtle)", borderRadius: 3 }}>
        <div style={{ width: `${Math.max(0, Math.min(progress, 1)) * 100}%`, height: "100%", background: "var(--accent)", transition: "width 0.6s ease", borderRadius: 3 }} />
      </div>
      <div style={{ marginTop: 4, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{`Level ${level} · ${totalXp} XP · ${xpToNext} to next`}</div>
    </div>
  );
}

export default XPBar;
