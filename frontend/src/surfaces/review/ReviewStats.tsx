import { useMemo } from "react";


import type { ReviewCard } from "../../../../shared/types";

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) {
 return null;
}
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function ReviewStats({ cards }: { cards: ReviewCard[] }): JSX.Element {
  const due = useMemo(() => cards.filter((c) => {
    const d = daysUntil(c.next_review_at);
    return d === null || d <= 0;
  }), [cards]);

  const avgEase = useMemo(() => {
    if (cards.length === 0) {
 return 0;
}
    return cards.reduce((s, c) => s + c.ease_factor, 0) / cards.length;
  }, [cards]);

  const matureDeck = useMemo(() => cards.filter((c) => c.interval >= 21).length, [cards]);

  return (
    <section
      style={{
        display: "flex",
        gap: "1.5rem",
        flexWrap: "wrap",
        padding: "1.1rem 1.25rem",
        background: "var(--surface-2)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div>
        <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700, color: "var(--accent)" }}>
          {due.length}
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>due now</span>
      </div>
      <div>
        <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700 }}>{cards.length}</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>total cards</span>
      </div>
      <div>
        <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700 }}>{avgEase.toFixed(2)}</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>avg ease</span>
      </div>
      <div>
        <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700 }}>{matureDeck}</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>mature (21d+)</span>
      </div>
    </section>
  );
}

export default ReviewStats;
