import { Modal } from "../../design-system/primitives/Modal";

export interface FocusCompleteModalProps {
  durationMinutes: number;
  taskTitle?: string | undefined;
  onLogToTask: () => void;
  onStartAnother: () => void;
  onStartBreak: (minutes: number) => void;
  onDismiss: () => void;
}

export function FocusCompleteModal({
  durationMinutes,
  taskTitle,
  onLogToTask,
  onStartAnother,
  onStartBreak,
  onDismiss,
}: FocusCompleteModalProps): JSX.Element {
  return (
    <Modal open title="" onClose={onDismiss}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "24px",
            display: "grid",
            placeItems: "center",
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--accent)",
            fontSize: "0.9rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
          }}
        >
          DONE
        </div>
        <div style={{ textAlign: "center" }}>
          <strong style={{ fontSize: "var(--text-xl)", display: "block", marginBottom: "0.5rem" }}>
            {durationMinutes}m focus complete!
          </strong>
          {taskTitle && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--accent)" }}>
              Working on: {taskTitle}
            </span>
          )}
          <p style={{ margin: "0.75rem 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Close the loop on the block now: mark the task done, take a real break, or roll straight into the next session.
          </p>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
            <button
              onClick={onLogToTask}
              style={{
                padding: "0.8rem 1rem",
                borderRadius: "10px",
                border: "none",
                background: "var(--accent)",
                color: "var(--text-inverted)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Finish task
            </button>
            <button
              onClick={onStartAnother}
              style={{
                padding: "0.8rem 1rem",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Start another 25m
            </button>
          </div>

          <div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              Take a deliberate break:
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[5, 10, 15].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => onStartBreak(minutes)}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--surface-2)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {minutes}m
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
            padding: "0.25rem",
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

export default FocusCompleteModal;
