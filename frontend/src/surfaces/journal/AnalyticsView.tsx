import { useMemo } from "react";

import type { JournalEntry } from "../../../../shared/types";

interface AnalyticsViewProps {
  entries: JournalEntry[];
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function allTags(entries: JournalEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

export function AnalyticsView({ entries }: AnalyticsViewProps): JSX.Element {
  const totalWords = useMemo(
    () => entries.reduce((sum, e) => sum + wordCount(e.markdown_body), 0),
    [entries]
  );

  const avgWords = entries.length > 0 ? Math.round(totalWords / entries.length) : 0;

  const tagCounts = useMemo(() => allTags(entries), [entries]);
  const topTags = useMemo(
    () => [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    [tagCounts]
  );

  const last7 = entries.slice(0, 7).reverse();
  const maxWords = Math.max(...last7.map((e) => wordCount(e.markdown_body)), 1);

  return (
    <section
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.25rem",
        background: "var(--surface)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <strong>Journal Analytics</strong>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <div>
          <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700, color: "var(--accent)" }}>
            {entries.length}
          </span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>entries</span>
        </div>
        <div>
          <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700 }}>{totalWords.toLocaleString()}</span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>total words</span>
        </div>
        <div>
          <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700 }}>{avgWords}</span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>avg words/entry</span>
        </div>
      </div>

      {last7.length > 0 && (
        <div>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>
            Word count — last 7 entries
          </span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "48px" }}>
            {last7.map((entry) => {
              const wc = wordCount(entry.markdown_body);
              const height = Math.max(4, Math.round((wc / maxWords) * 48));
              return (
                <div
                  key={entry.id}
                  title={`${entry.date}: ${wc} words`}
                  style={{
                    flex: 1,
                    height: `${height}px`,
                    background: "var(--accent)",
                    borderRadius: "3px 3px 0 0",
                    opacity: 0.7,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {topTags.length > 0 && (
        <div>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>
            Top tags
          </span>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {topTags.map(([tag, count]) => (
              <span
                key={tag}
                style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "999px",
                  background: "var(--surface-2)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                #{tag} <span style={{ color: "var(--text-secondary)" }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default AnalyticsView;
