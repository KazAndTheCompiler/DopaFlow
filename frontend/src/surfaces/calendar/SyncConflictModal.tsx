import Button from "../../design-system/primitives/Button";
import Modal from "../../design-system/primitives/Modal";
import type { SyncConflict } from "../../../../shared/types";

interface SyncConflictModalProps {
  conflicts: SyncConflict[];
  onResolve: (id: number, resolution: "prefer_local" | "prefer_incoming") => Promise<void>;
  onClose: () => void;
}

export function SyncConflictModal({ conflicts, onResolve, onClose }: SyncConflictModalProps): JSX.Element {
  return (
    <Modal open={true} title="Sync conflicts" onClose={onClose}>
      <div
      style={{
        marginTop: "-0.35rem",
        marginBottom: "1rem",
        padding: "0.85rem 0.95rem",
        borderRadius: "16px",
        border: "1px solid var(--border-subtle)",
        background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "0.2rem",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 800,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Repair queue
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Resolve which version should win before the next sync cycle.
        </span>
      </div>
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          padding: "0.25rem 0.6rem",
          borderRadius: "999px",
          background: "color-mix(in srgb, var(--state-overdue) 16%, transparent)",
          color: "var(--state-overdue)",
          letterSpacing: "0.04em",
        }}
      >
        {conflicts.length} open
      </span>
    </div>

      <div style={{ overflowY: "auto", display: "grid", gap: "0.65rem" }}>
          {conflicts.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", textAlign: "center", padding: "2rem 0" }}>
              No conflicts — everything is in sync.
            </p>
          ) : (
            conflicts.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--surface-2, var(--surface))",
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div style={{ display: "grid", gap: "0.2rem" }}>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                      {c.object_type} · <code style={{ fontFamily: "monospace", fontSize: "0.75em" }}>{c.object_id}</code>
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                      {c.conflict_reason}
                    </span>
                    {c.repair_hint && (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--state-warn)" }}>
                        Hint: {c.repair_hint}
                      </span>
                    )}
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted, var(--text-secondary))" }}>
                      Detected {new Date(c.detected_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <Button
                    onClick={() => void onResolve(c.id, "prefer_local")}
                    variant="secondary"
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                    }}
                  >
                    Keep local
                  </Button>
                  <Button
                    onClick={() => void onResolve(c.id, "prefer_incoming")}
                    variant="ghost"
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                    }}
                  >
                    Use incoming
                  </Button>
                </div>
              </div>
            ))
          )}
      </div>
    </Modal>
  );
}

export default SyncConflictModal;
