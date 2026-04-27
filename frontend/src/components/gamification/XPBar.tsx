const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5700, 7500,
];

export interface XPBarProps {
  totalXp: number;
  level: number;
  progress: number;
  xpToNext: number;
}

export function XPBar({
  totalXp,
  level,
  progress,
  xpToNext,
}: XPBarProps): JSX.Element {
  const floor = level <= 1 ? 0 : (LEVEL_THRESHOLDS[level - 1] ?? 0);
  const ceiling = LEVEL_THRESHOLDS[level] ?? totalXp;
  const currentXP = Math.max(0, totalXp - floor);
  const xpForNextLevel = Math.max(ceiling - floor, 1);
  const displayProgress =
    xpToNext === 0 && currentXP === xpForNextLevel
      ? Math.min(currentXP / xpForNextLevel, 0.99)
      : Math.max(0, Math.min(progress, 1));

  return (
    <div style={{ minWidth: 180 }}>
      <div
        style={{
          width: "100%",
          height: 6,
          background: "var(--border-subtle)",
          borderRadius: 3,
        }}
      >
        <div
          style={{
            width: `${displayProgress * 100}%`,
            height: "100%",
            background: "var(--accent)",
            transition: "width 0.6s ease",
            borderRadius: 3,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
        }}
      >{`Level ${level} · ${totalXp} XP · ${xpToNext} to next`}</div>
    </div>
  );
}

export default XPBar;
