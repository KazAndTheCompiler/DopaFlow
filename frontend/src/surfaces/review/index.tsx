import { useContext, useMemo, useState } from "react";

import { AppDataContext } from "../../App";
import CardReviewer from "./CardReviewer";
import DeckList from "./DeckList";
import ReviewStats from "./ReviewStats";
import { ReviewSurfaceSkeleton } from "@ds/primitives/Skeleton";

export default function ReviewView(): JSX.Element {
  const app = useContext(AppDataContext);
  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const [selectedDeckId, setSelectedDeckId] = useState<string>("deck_default");
  const [sessionDone, setSessionDone] = useState(0);
  const visibleCards = useMemo(
    () => app.review.cards.filter((card) => !selectedDeckId || card.deck_id === selectedDeckId),
    [app.review.cards, selectedDeckId],
  );
  const dueCards = useMemo(
    () => visibleCards.filter((card) => !card.next_review_at || new Date(card.next_review_at) <= new Date()),
    [visibleCards],
  );
  const currentCard = dueCards[0];

  if (app.review.loading) {
    return <ReviewSurfaceSkeleton />;
  }

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      <div style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
        <ReviewStats cards={visibleCards} />
        <CardReviewer
          card={currentCard}
          totalDue={dueCards.length}
          sessionDone={sessionDone}
          onRate={(rating) => {
            if (!currentCard) return;
            void app.review.rate(currentCard.id, rating).then(() => setSessionDone((n) => n + 1));
          }}
        />
      </div>

      <section
        style={{
          padding: "1.25rem",
          background: "var(--surface)",
          borderRadius: "20px",
          border: "1px solid var(--border-subtle)",
          display: "grid",
          gap: "0.5rem",
          alignContent: "start",
        }}
      >
        <DeckList onSelectDeck={setSelectedDeckId} />
        <strong>Queue ({dueCards.length})</strong>
        {dueCards.length === 0 && (
          <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>All caught up. OK</span>
        )}
        {dueCards.slice(0, 20).map((card, i) => (
          <div
            key={card.id}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "10px",
              background: i === 0 ? "var(--surface-2)" : "transparent",
              border: i === 0 ? "1px solid var(--accent)" : "none",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "var(--text-sm)",
                fontWeight: i === 0 ? 600 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {card.front}
            </span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {card.next_review_at ? `Due: ${new Date(card.next_review_at).toLocaleDateString()}` : "New"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
