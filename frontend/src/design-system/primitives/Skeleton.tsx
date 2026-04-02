import type { CSSProperties } from "react";

const shimmerStyle: CSSProperties = {
  background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
};

const styles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

// Inject keyframe animation into document
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = styles;
  document.head.appendChild(style);
}

export interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
}

export function Skeleton({
  width = "100%",
  height = "16px",
  borderRadius = "6px",
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

export function SkeletonCard({ height = "80px" }: SkeletonCardProps): JSX.Element {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "18px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.5rem",
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
        padding: "0.75rem 1rem",
        borderRadius: "18px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        position: "relative",
        display: "grid",
        gap: "0.5rem",
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: "0.75rem 0.5rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          {showAvatar && <Skeleton width="32px" height="32px" borderRadius="50%" />}
          <div style={{ flex: 1, display: "grid", gap: "0.4rem" }}>
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: "1.25rem",
            borderRadius: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            display: "grid",
            gap: "0.5rem",
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
