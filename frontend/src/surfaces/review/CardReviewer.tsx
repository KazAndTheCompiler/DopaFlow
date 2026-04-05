import { useCallback, useEffect, useState } from "react";

import type { ReviewCard } from "../../../../shared/types";

interface CardReviewerProps {
  card?: ReviewCard;
  totalDue?: number;
  sessionDone?: number;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  onEditCard?: (card: ReviewCard) => void;
}

const RATINGS: Array<{ value: 1 | 2 | 3 | 4; label: string; color: string; key: string }> = [
  { value: 1, label: "Again", color: "var(--state-overdue)", key: "1" },
  { value: 2, label: "Hard", color: "var(--state-warn)", key: "2" },
  { value: 3, label: "Good", color: "var(--accent)", key: "3" },
  { value: 4, label: "Easy", color: "var(--state-completed)", key: "4" },
];

export function CardReviewer({
  card,
  totalDue = 0,
  sessionDone = 0,
  onRate,
  onEditCard,
}: CardReviewerProps): JSX.Element {
  const [flipped, setFlipped] = useState<boolean>(false);
  const total = totalDue + sessionDone;
  const pct = total > 0 ? Math.round((sessionDone / total) * 100) : 0;

  // Reset flip state when card changes
  useEffect(() => {
    setFlipped(false);
  }, [card?.id]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire when focus is inside an input/textarea
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (!card) return;

      if (e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFlipped((prev) => !prev);
        return;
      }

      if (flipped) {
        if (e.key === "1") { onRate(1); setFlipped(false); }
        else if (e.key === "2") { onRate(2); setFlipped(false); }
        else if (e.key === "3") { onRate(3); setFlipped(false); }
        else if (e.key === "4") { onRate(4); setFlipped(false); }
      }
    },
    [card, flipped, onRate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Session complete screen
  if (!card) {
    if (sessionDone > 0) {
      return (
        <section
          style={{
            padding: "2.5rem 1.5rem",
            background: "var(--surface)",
            borderRadius: "20px",
            border: "1px solid var(--border-subtle)",
            textAlign: "center",
            display: "grid",
            gap: "0.85rem",
          }}
        >
          <span style={{ fontSize: "2.5rem" }}>✓</span>
          <strong style={{ fontSize: "var(--text-lg)", letterSpacing: "-0.02em" }}>Session complete</strong>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
            You reviewed{" "}
            <strong style={{ color: "var(--text-primary)" }}>{sessionDone} card{sessionDone === 1 ? "" : "s"}</strong>
            {" "}this session.
            {totalDue === 0
              ? " Nothing else is due — come back tomorrow."
              : ` ${totalDue} card${totalDue === 1 ? " is" : "s are"} still due in other decks.`}
          </p>
          <div
            style={{
              padding: "0.7rem 1rem",
              borderRadius: "12px",
              background: "color-mix(in srgb, var(--accent) 10%, var(--surface-2))",
              border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--border-subtle))",
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            Intervals updated · cards will surface again when due
          </div>
        </section>
      );
    }

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
        aria-label={flipped ? "Card back — press Space or F to flip" : "Card front — press Space or F to flip"}
        onClick={() => setFlipped((prev) => !prev)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFlipped((prev) => !prev)}
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
        <div style={{ position: "absolute", top: "0.6rem", left: "0.75rem", right: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {flipped ? "Back" : "Front"} · <kbd style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem", borderRadius: "4px", background: "var(--border)", fontFamily: "monospace" }}>Space</kbd> to flip
          </span>
          {onEditCard && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditCard(card); }}
              title="Edit this card"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                borderRadius: "8px",
                padding: "0.2rem 0.5rem",
                cursor: "pointer",
                fontSize: "var(--text-xs)",
              }}
            >
              Edit
            </button>
          )}
        </div>

        <p style={{ fontSize: "var(--text-lg)", fontWeight: flipped ? 400 : 600, margin: 0 }}>
          {flipped ? card.back : card.front}
        </p>

        {card.next_review_at && !flipped && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Interval: {card.interval}d · Ease: {card.ease_factor.toFixed(2)} · {card.reviews_done} reviews
          </span>
        )}
      </div>

      {flipped ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            {RATINGS.map(({ value, label, color, key }) => (
              <button
                key={value}
                onClick={() => { onRate(value); setFlipped(false); }}
                title={`Rate: ${label} (press ${key})`}
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
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.2rem",
                }}
              >
                <span>{label}</span>
                <kbd style={{ fontSize: "0.6rem", padding: "0.05rem 0.3rem", borderRadius: "3px", background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid ${color}`, fontFamily: "monospace", opacity: 0.8 }}>
                  {key}
                </kbd>
              </button>
            ))}
          </div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textAlign: "center" }}>
            Press 1–4 to rate · Space to flip back
          </span>
        </div>
      ) : (
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
          Show Answer <kbd style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem", borderRadius: "4px", background: "rgba(255,255,255,0.2)", fontFamily: "monospace", marginLeft: "0.35rem" }}>Space</kbd>
        </button>
      )}
    </section>
  );
}

export default CardReviewer;
