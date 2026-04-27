import { useCallback, useEffect, useState } from "react";

import { listDueReviewCards, rateReviewCard } from "@api/index";
import type { ReviewCard } from "../../../../shared/types";

interface CardReviewerProps {
  deckId: string;
  totalDue?: number;
  sessionDone?: number;
  onRated?: () => void;
  onEditCard?: (card: ReviewCard) => void;
}

const RATINGS: Array<{
  value: 1 | 2 | 3 | 4;
  label: string;
  color: string;
  key: string;
}> = [
  { value: 1, label: "Again", color: "var(--state-overdue)", key: "1" },
  { value: 2, label: "Hard", color: "var(--state-warn)", key: "2" },
  { value: 3, label: "Good", color: "var(--accent)", key: "3" },
  { value: 4, label: "Easy", color: "var(--state-completed)", key: "4" },
];
const BATCH_SIZE = 20;
const PREFETCH_THRESHOLD = 5;

function formatNextDueInterval(interval: number): string {
  if (interval < 1) {
    const hours = Math.max(1, Math.ceil(interval * 24));
    return `due in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(interval);
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

export function CardReviewer({
  deckId,
  totalDue = 0,
  sessionDone = 0,
  onRated,
  onEditCard,
}: CardReviewerProps): JSX.Element {
  const [flipped, setFlipped] = useState<boolean>(false);
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [started, setStarted] = useState<boolean>(false);
  const card = queue[0];
  const remainingDue = Math.max(totalDue - sessionDone, queue.length);
  const total = remainingDue + sessionDone;
  const pct = total > 0 ? Math.round((sessionDone / total) * 100) : 0;

  const loadQueue = useCallback(
    async (offset: number, replace: boolean) => {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const cards = await listDueReviewCards(deckId, BATCH_SIZE, offset);
        setHasMore(cards.length === BATCH_SIZE);
        setQueue((prev) => {
          if (replace) {
            return cards;
          }
          const seen = new Set(prev.map((item) => item.id));
          return [...prev, ...cards.filter((item) => !seen.has(item.id))];
        });
      } finally {
        if (replace) {
          setLoading(false);
          setStarted(true);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [deckId],
  );

  useEffect(() => {
    setQueue([]);
    setHasMore(true);
    setStarted(false);
    setFlipped(false);
    void loadQueue(0, true);
  }, [deckId, loadQueue]);

  useEffect(() => {
    if (
      !started ||
      loading ||
      loadingMore ||
      !hasMore ||
      queue.length >= PREFETCH_THRESHOLD
    ) {
      return;
    }
    void loadQueue(queue.length, false);
  }, [hasMore, loadQueue, loading, loadingMore, queue.length, started]);

  useEffect(() => {
    setFlipped(false);
  }, [card?.id]);

  const handleRate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!card) {
        return;
      }
      await rateReviewCard({ cardId: card.id, rating });
      setQueue((prev) => prev.filter((item) => item.id !== card.id));
      onRated?.();
    },
    [card, onRated],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (!card) {
        return;
      }

      if (e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFlipped((prev) => !prev);
        return;
      }

      if (flipped) {
        if (e.key === "1") {
          void handleRate(1);
        } else if (e.key === "2") {
          void handleRate(2);
        } else if (e.key === "3") {
          void handleRate(3);
        } else if (e.key === "4") {
          void handleRate(4);
        }
      }
    },
    [card, flipped, handleRate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
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
        Loading review session…
      </section>
    );
  }

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
          <strong
            style={{ fontSize: "var(--text-lg)", letterSpacing: "-0.02em" }}
          >
            Session complete
          </strong>
          <p
            style={{
              margin: 0,
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.6,
            }}
          >
            You reviewed{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {sessionDone} card{sessionDone === 1 ? "" : "s"}
            </strong>{" "}
            this session.
            {remainingDue === 0
              ? " Nothing else is due — come back tomorrow."
              : ` ${remainingDue} card${remainingDue === 1 ? " is" : "s are"} still due in other decks.`}
          </p>
          <div
            style={{
              padding: "0.7rem 1rem",
              borderRadius: "12px",
              background:
                "color-mix(in srgb, var(--accent) 10%, var(--surface-2))",
              border:
                "1px solid color-mix(in srgb, var(--accent) 20%, var(--border-subtle))",
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}
          >
            <span>{sessionDone} done</span>
            <span>{remainingDue} remaining</span>
          </div>
          <div
            style={{
              height: "5px",
              borderRadius: "999px",
              background: "var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "var(--accent)",
                borderRadius: "999px",
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={
          flipped
            ? "Card back — press Space or F to flip"
            : "Card front — press Space or F to flip"
        }
        onClick={() => setFlipped((prev) => !prev)}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && setFlipped((prev) => !prev)
        }
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
        <div
          style={{
            position: "absolute",
            top: "0.6rem",
            left: "0.75rem",
            right: "0.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {flipped ? "Back" : "Front"} ·{" "}
            <kbd
              style={{
                fontSize: "0.65rem",
                padding: "0.1rem 0.3rem",
                borderRadius: "4px",
                background: "var(--border)",
                fontFamily: "monospace",
              }}
            >
              Space
            </kbd>{" "}
            to flip
          </span>
          {onEditCard && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditCard(card);
              }}
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

        <p
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: flipped ? 400 : 600,
            margin: 0,
          }}
        >
          {flipped ? card.back : card.front}
        </p>

        {card.next_review_at && !flipped && (
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            Next: {formatNextDueInterval(card.interval)} · Ease:{" "}
            {card.ease_factor.toFixed(2)} · {card.reviews_done} reviews
          </span>
        )}
      </div>

      {flipped ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <div
            style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}
          >
            {RATINGS.map(({ value, label, color, key }) => (
              <button
                key={value}
                onClick={() => {
                  void handleRate(value);
                  setFlipped(false);
                }}
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
                <kbd
                  style={{
                    fontSize: "0.6rem",
                    padding: "0.05rem 0.3rem",
                    borderRadius: "3px",
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    border: `1px solid ${color}`,
                    fontFamily: "monospace",
                    opacity: 0.8,
                  }}
                >
                  {key}
                </kbd>
              </button>
            ))}
          </div>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
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
          Show Answer{" "}
          <kbd
            style={{
              fontSize: "0.65rem",
              padding: "0.1rem 0.35rem",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.2)",
              fontFamily: "monospace",
              marginLeft: "0.35rem",
            }}
          >
            Space
          </kbd>
        </button>
      )}
    </section>
  );
}

export default CardReviewer;
