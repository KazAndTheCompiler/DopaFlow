interface BackupStatusProps {
  backupPath?: string | null | undefined;
  lastBackupAt?: string | null | undefined;
  onTrigger?: () => Promise<void>;
}

export function BackupStatus({
  backupPath,
  lastBackupAt,
  onTrigger,
}: BackupStatusProps): JSX.Element {
  return (
    <section
      style={{
        padding: "1.1rem 1.25rem",
        background:
          "linear-gradient(160deg, color-mix(in srgb, var(--surface-2) 90%, white 10%), var(--surface-2))",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.6rem",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Journal backup</span>
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Keep your writing durable. Local backups are still the core safety net
          even if cloud sync grows later.
        </span>
      </div>

      <div
        style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}
      >
        Path:{" "}
        <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>
          {backupPath ?? "~/.local/share/DopaFlow/journal-backup/"}
        </span>
      </div>

      {lastBackupAt ? (
        <div
          style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}
        >
          Last backup:{" "}
          <strong style={{ color: "var(--state-completed)" }}>
            {new Date(lastBackupAt).toLocaleString()}
          </strong>
        </div>
      ) : (
        <div
          style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}
        >
          No backup recorded yet.
        </div>
      )}

      {onTrigger && (
        <button
          onClick={() => void onTrigger()}
          style={{
            padding: "0.4rem 1rem",
            borderRadius: "8px",
            border: "1px solid var(--accent)",
            background: "transparent",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
            justifySelf: "start",
            marginTop: "0.25rem",
          }}
        >
          Create backup now
        </button>
      )}
    </section>
  );
}

export default BackupStatus;
