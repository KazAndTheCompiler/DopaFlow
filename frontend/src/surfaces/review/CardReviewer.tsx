import { useState } from "react";

import type { ReviewCard } from "../../../../shared/types";

interface CardReviewerProps {
  card?: ReviewCard;
  totalDue?: number;
  sessionDone?: number;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
}

const RATINGS: Array<{ value: 1 | 2 | 3 | 4; label: string; color: string }> = [
  { value: 1, label: "Again", color: "var(--state-overdue)" },
  { value: 2, label: "Hard", color: "var(--state-warn)" },
  { value: 3, label: "Good", color: "var(--accent)" },
  { value: 4, label: "Easy", color: "var(--state-completed)" },
];

export function CardReviewer({ card, totalDue = 0, sessionDone = 0, onRate }: CardReviewerProps): JSX.Element {
  const [flipped, setFlipped] = useState<boolean>(false);
  const total = totalDue + sessionDone;
  const pct = total > 0 ? Math.round((sessionDone / total) * 100) : 0;

  if (!card) {
    return (
      <section
        style={{
          padding: "3rem 1.5rem",
          background: "var(--surface)",
          borderRadius: "20px",
          border: "1px solid var(--border-subtle)",
          textAlign: "center",
          color: "var(--text-secondary)",
        }}
      >
        No cards due. Great work — come back later.
      </section>
    );
  }

  return (
    <section
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.5rem",
        background: "var(--surface)",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {total > 0 && (
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            <span>{sessionDone} done</span>
            <span>{totalDue} remaining</span>
          </div>
          <div style={{ height: "5px", borderRadius: "999px", background: "var(--border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: "999px", transition: "width 300ms ease" }} />
          </div>
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        onClick={() => setFlipped((prev) => !prev)}
        onKeyDown={(e) => e.key === "Enter" && setFlipped((prev) => !prev)}
        style={{
          minHeight: "180px",
          padding: "1.5rem",
          background: "var(--surface-2)",
          borderRadius: "14px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: "0.75rem",
          position: "relative",
          userSelect: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "0.6rem",
            right: "0.75rem",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {flipped ? "Back" : "Front"} · tap to flip
        </span>
        <p style={{ fontSize: "var(--text-lg)", fontWeight: flipped ? 400 : 600, margin: 0 }}>
          {flipped ? card.back : card.front}
        </p>
        {card.next_review_at && !flipped && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Interval: {card.interval}d · Ease: {card.ease_factor.toFixed(2)} · {card.reviews_done} reviews
          </span>
        )}
      </div>

      {flipped && (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          {RATINGS.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => {
                onRate(value);
                setFlipped(false);
              }}
              style={{
                flex: 1,
                padding: "0.65rem 0",
                borderRadius: "10px",
                border: `1px solid ${color}`,
                background: "transparent",
                color,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!flipped && (
        <button
          onClick={() => setFlipped(true)}
          style={{
            padding: "0.65rem",
            borderRadius: "10px",
            border: "none",
            background: "var(--accent)",
            color: "var(--text-inverted)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Show Answer
        </button>
      )}
    </section>
  );
}

export default CardReviewer;
