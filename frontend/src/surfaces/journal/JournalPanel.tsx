import type { JournalEntry } from "../../../../shared/types";
import EmptyState from "@ds/primitives/EmptyState";
import { SkeletonList } from "@ds/primitives/Skeleton";

interface JournalPanelProps {
  entries: JournalEntry[];
  loading?: boolean;
  selectedDate: string;
  backupPath?: string | null | undefined;
  lastBackupAt?: string | null | undefined;
  onSelectDate: (date: string) => void;
  onTriggerBackup: () => void;
}

function moodIcon(emoji?: string | null): string {
  return emoji ?? "JR";
}

export function JournalPanel({
  entries,
  loading = false,
  selectedDate,
  backupPath,
  lastBackupAt,
  onSelectDate,
  onTriggerBackup,
}: JournalPanelProps): JSX.Element {
  if (loading) {
    return <SkeletonList rows={5} />;
  }

  return (
    <aside
      style={{
        display: "grid",
        gap: "0.75rem",
        alignContent: "start",
      }}
    >
      <section
        style={{
          padding: "1rem",
          background: "var(--surface)",
          borderRadius: "18px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <strong style={{ display: "block", marginBottom: "0.6rem" }}>Entries</strong>
        {entries.length === 0 && (
          <div style={{ marginBottom: "0.75rem" }}>
            <EmptyState icon="JR" title="No entries" subtitle="Start writing — your first entry is waiting." />
          </div>
        )}
        <div style={{ display: "grid", gap: "0.3rem" }}>
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelectDate(entry.date)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.45rem 0.65rem",
                borderRadius: "10px",
                border: "1px solid",
                borderColor: entry.date === selectedDate ? "var(--accent)" : "transparent",
                background: entry.date === selectedDate ? "var(--surface-2)" : "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{moodIcon(entry.emoji)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 500, fontSize: "var(--text-sm)" }}>{entry.date}</span>
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.markdown_body.slice(0, 48) || "Empty entry"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section
        style={{
          padding: "0.9rem 1rem",
          background: "var(--surface)",
          borderRadius: "18px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <strong style={{ display: "block", marginBottom: "0.4rem", fontSize: "var(--text-sm)" }}>Auto-backup</strong>
        <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          {backupPath ?? "Not configured"}
        </span>
        {lastBackupAt && (
          <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Last: {lastBackupAt}
          </span>
        )}
        <button
          onClick={onTriggerBackup}
          style={{
            fontSize: "var(--text-sm)",
            padding: "0.35rem 0.8rem",
            borderRadius: "8px",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          Back up today
        </button>
      </section>
    </aside>
  );
}

export default JournalPanel;
