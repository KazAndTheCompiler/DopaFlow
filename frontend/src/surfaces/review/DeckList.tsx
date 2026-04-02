import { useEffect, useRef, useState } from "react";

import type { ReviewDeck, DeckStats } from "@api/review";
import { createReviewDeck, deleteReviewDeck, getDeckStats, importApkg, listReviewDecks, renameReviewDeck } from "@api/index";
import DeckExportButton from "../../components/review/DeckExportButton";
import Button from "@ds/primitives/Button";
import EmptyState from "@ds/primitives/EmptyState";
import { SkeletonList } from "@ds/primitives/Skeleton";

export interface DeckListProps {
  onSelectDeck: (deckId: string) => void;
}

export function DeckList({ onSelectDeck }: DeckListProps): JSX.Element {
  const [decks, setDecks] = useState<ReviewDeck[]>([]);
  const [stats, setStats] = useState<Record<string, DeckStats>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [draftName, setDraftName] = useState<string>("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDeckId, setImportDeckId] = useState<string>("deck_default");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      const deckList = await listReviewDecks();
      setDecks(deckList);
      // Fetch stats for all decks in parallel
      const statsPromises = deckList.map((deck) =>
        getDeckStats(deck.id).catch(() => null)
      );
      const statsResults = await Promise.all(statsPromises);
      const newStats: Record<string, DeckStats> = {};
      statsResults.forEach((stat, index) => {
        if (stat) {
          newStats[deckList[index].id] = stat;
        }
      });
      setStats(newStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const result = await importApkg(importDeckId, file);
      setImportStatus(`Imported — ${result.imported} cards (${result.skipped} skipped)`);
      await refresh();
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) {
    return <SkeletonList rows={3} />;
  }

  return (
    <section
      style={{
        padding: "1rem",
        background: "var(--surface)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <strong>Decks</strong>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{decks.length} total</span>
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            variant="secondary"
            style={{ padding: "0.3rem 0.7rem", fontSize: "var(--text-sm)" }}
          >
            {importing ? "Importing…" : "Import .apkg"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".apkg"
            style={{ display: "none" }}
            onChange={(e) => void handleImport(e)}
          />
        </div>
      </div>

      {importStatus && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            background: importStatus.startsWith("Import failed") ? "color-mix(in srgb, var(--state-overdue) 12%, transparent)" : "color-mix(in srgb, var(--state-ok) 12%, transparent)",
            color: importStatus.startsWith("Import failed") ? "var(--state-overdue)" : "var(--state-ok)",
            fontSize: "var(--text-sm)",
          }}
        >
          {importStatus}
        </div>
      )}

      {importing && (
        <div style={{ padding: "0.5rem 0.75rem", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span>Import to deck:</span>
            <select
              value={importDeckId}
              onChange={(e) => setImportDeckId(e.currentTarget.value)}
              disabled={importing}
              style={{
                padding: "0.4rem",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
              }}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {decks.length === 0 && (
        <EmptyState icon="RV" title="No decks yet" subtitle="Import an Anki deck or create one to start reviewing." />
      )}

      {decks.map((deck) => {
        const deckStats = stats[deck.id];
        const hasStats = deckStats && deckStats.total_cards > 0;
        const retention = hasStats && deckStats.total_cards > 0
          ? Math.round((deckStats.average_interval / 365) * 100)
          : null;

        return (
          <div
            key={deck.id}
            style={{
              padding: "0.9rem",
              borderRadius: "14px",
              background: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gap: "0.45rem",
            }}
          >
            {renamingId === deck.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = renameValue.trim();
                  if (!name) return;
                  void renameReviewDeck(deck.id, name).then(() => {
                    setRenamingId(null);
                    void refresh();
                  });
                }}
                style={{ display: "flex", gap: "0.4rem" }}
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.currentTarget.value)}
                  style={{ flex: 1, padding: "0.35rem 0.6rem", borderRadius: "8px", border: "1px solid var(--accent)", background: "var(--surface)", color: "var(--text)", fontSize: "var(--text-sm)" }}
                />
                <Button type="submit" variant="primary" style={{ padding: "0.35rem 0.65rem", fontSize: "var(--text-sm)" }}>Save</Button>
                <Button type="button" onClick={() => setRenamingId(null)} variant="ghost" style={{ padding: "0.35rem 0.65rem", fontSize: "var(--text-sm)" }}>Cancel</Button>
              </form>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong style={{ flex: 1 }}>{deck.name}</strong>
                <button
                  onClick={() => { setRenamingId(deck.id); setRenameValue(deck.name); }}
                  title="Rename deck"
                  style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "var(--text-sm)", padding: "0.2rem 0.4rem", borderRadius: "6px" }}
                >
                  RN
                </button>
                {deletingId === deck.id ? (
                  <>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--state-overdue)" }}>Delete deck + all cards?</span>
                    <button
                      onClick={() => void deleteReviewDeck(deck.id).then(() => { setDeletingId(null); void refresh(); })}
                      style={{ border: "none", background: "var(--state-overdue)", color: "white", cursor: "pointer", fontSize: "var(--text-xs)", padding: "0.2rem 0.5rem", borderRadius: "6px", fontWeight: 600 }}
                    >
                      Confirm
                    </button>
                    <Button onClick={() => setDeletingId(null)} variant="ghost" style={{ fontSize: "var(--text-xs)", padding: "0.2rem 0.5rem" }}>Cancel</Button>
                  </>
                ) : (
                  <button
                    onClick={() => setDeletingId(deck.id)}
                    title="Delete deck"
                    style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "var(--text-sm)", padding: "0.2rem 0.4rem", borderRadius: "6px" }}
                  >
                    X
                  </button>
                )}
              </div>
            )}
            <DeckExportButton deckId={deck.id} />
            <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
              {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
            </span>
            {deckStats && deckStats.due_cards > 0 && (
              <span style={{
                color: "var(--state-warn)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
              }}>
                DUE {deckStats.due_cards} today
              </span>
            )}
            {retention !== null && deckStats!.total_cards > 0 && (
              <span style={{
                color: retention > 70 ? "var(--state-ok)" : "var(--state-warn)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
              }}>
                RT {retention}% retention
              </span>
            )}
            <Button
              onClick={() => onSelectDeck(deck.id)}
              variant="primary"
              style={{ justifySelf: "start", borderRadius: "999px" }}
            >
              Review now
            </Button>
          </div>
        );
      })}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const name = draftName.trim();
          if (!name) return;
          void (async () => {
            await createReviewDeck({ name, source_type: "manual" });
            setDraftName("");
            await refresh();
          })();
        }}
        style={{ display: "grid", gap: "0.55rem", marginTop: "0.25rem" }}
      >
        <strong style={{ fontSize: "var(--text-sm)" }}>New deck</strong>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.currentTarget.value)}
            placeholder="Spanish verbs"
            style={{
              flex: 1,
              padding: "0.65rem 0.8rem",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          />
          <Button type="submit" variant="primary" style={{ padding: "0.65rem 0.9rem" }}>
            Create
          </Button>
        </div>
      </form>
    </section>
  );
}

export default DeckList;
