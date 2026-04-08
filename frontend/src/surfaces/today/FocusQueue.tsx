import type { FocusSession, Task } from "../../../../shared/types";

export interface FocusQueueProps {
  tasks: Task[];
  activeSession?: FocusSession | undefined;
  onStartFocus: (taskId: string, durationMinutes?: number) => void;
  onComplete: (taskId: string) => void;
}

const QUEUE_SOFT_LIMIT = 5;
const QUEUE_WARN_AT = 6;

function priorityDot(priority: number): JSX.Element {
  const color =
    priority === 1 ? "var(--state-overdue)"
    : priority === 2 ? "var(--state-warn)"
    : priority === 3 ? "var(--state-completed)"
    : "var(--text-muted)";
  return (
    <span
      aria-hidden="true"
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        marginTop: "2px",
      }}
    />
  );
}

export function FocusQueue({ tasks, activeSession, onStartFocus, onComplete }: FocusQueueProps): JSX.Element {
  const pending = tasks.filter((t) => !t.done);
  const queue = [...pending]
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      const leftDue = left.due_at ? new Date(left.due_at).getTime() : Number.POSITIVE_INFINITY;
      const rightDue = right.due_at ? new Date(right.due_at).getTime() : Number.POSITIVE_INFINITY;
      return leftDue - rightDue;
    })
    .slice(0, QUEUE_SOFT_LIMIT);

  const hiddenCount = Math.max(0, pending.length - QUEUE_SOFT_LIMIT);
  const isOverfull = pending.length >= QUEUE_WARN_AT;
  const hasActiveSession = Boolean(activeSession);

  return (
    <section
      style={{
        padding: "1.1rem 1.15rem",
        borderRadius: "20px",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "var(--surface-glass-blur, blur(14px))",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.85rem",
        position: "relative",
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Focus Queue</strong>
        <span
          style={{
            padding: "0.15rem 0.55rem",
            borderRadius: "999px",
            background: isOverfull
              ? "color-mix(in srgb, var(--state-warn) 15%, transparent)"
              : "var(--surface-2)",
            border: isOverfull
              ? "1px solid color-mix(in srgb, var(--state-warn) 35%, transparent)"
              : "1px solid transparent",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: isOverfull ? "var(--state-warn)" : "var(--text-secondary)",
          }}
        >
          {queue.length}{hiddenCount > 0 ? ` of ${pending.length}` : ""}
        </span>
      </div>

      {/* Resume banner — shown when a session is already running */}
      {hasActiveSession && (
        <div
          style={{
            padding: "0.75rem 0.9rem",
            borderRadius: "14px",
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1rem", color: "var(--accent)", flexShrink: 0 }}>▶</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "block" }}>
              Session in progress
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              Pick up where you left off — open Focus to resume or finish.
            </span>
          </div>
          <button
            onClick={() => { window.location.hash = "#/focus"; }}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent)",
              color: "var(--text-inverted)",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Resume
          </button>
        </div>
      )}

      {/* Overfull nudge */}
      {isOverfull && (
        <div
          style={{
            padding: "0.6rem 0.85rem",
            borderRadius: "12px",
            background: "color-mix(in srgb, var(--state-warn) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--state-warn) 22%, transparent)",
            fontSize: "var(--text-xs)",
            color: "var(--state-warn)",
            fontWeight: 600,
          }}
        >
          {pending.length} tasks queued — a shorter list keeps execution sharper. Consider trimming to 3–5.
        </div>
      )}

      {/* Empty state */}
      {queue.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            borderRadius: "16px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border-subtle)",
            display: "grid",
            gap: "0.4rem",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>—</span>
          <strong style={{ fontSize: "var(--text-sm)" }}>Nothing queued yet</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Drag a task here from the backlog, or open Today to choose your first move.
          </span>
        </div>
      ) : (
        <>
          {queue.map((task, index) => {
            const dueDate = task.due_at ? new Date(task.due_at) : null;
            const overdue = dueDate !== null && dueDate.getTime() < Date.now();
            const isActive = activeSession?.task_id === task.id;
            const isNext = index === 0 && !hasActiveSession;

            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  padding: "0.65rem 0.8rem",
                  borderRadius: "14px",
                  background: isActive
                    ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                    : isNext
                    ? "color-mix(in srgb, var(--surface-2) 80%, white 20%)"
                    : "var(--surface-2)",
                  border: isActive
                    ? "1px solid color-mix(in srgb, var(--accent) 22%, transparent)"
                    : "1px solid transparent",
                  transition: "background 150ms ease",
                }}
              >
                {priorityDot(task.priority)}
                <div style={{ flex: 1, minWidth: 0, display: "grid", gap: "0.1rem" }}>
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: isNext ? 600 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {task.title}
                  </span>
                  {overdue && dueDate && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--state-overdue)" }}>
                      Overdue · {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                <button
                  disabled={isActive}
                  onClick={() => onStartFocus(task.id)}
                  aria-label={isActive ? `${task.title} — session active` : `Start focus session for ${task.title}`}
                  style={{
                    padding: "0.3rem 0.8rem",
                    borderRadius: "8px",
                    border: "none",
                    background: isActive
                      ? "var(--surface-2)"
                      : isNext
                      ? "var(--accent)"
                      : "color-mix(in srgb, var(--accent) 15%, transparent)",
                    color: isActive
                      ? "var(--text-secondary)"
                      : isNext
                      ? "var(--text-inverted)"
                      : "var(--accent)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    cursor: isActive ? "default" : "pointer",
                    transition: "background 150ms ease",
                    flexShrink: 0,
                  }}
                >
                  {isActive ? "Active" : isNext ? "Start" : "Focus"}
                </button>
                <button
                  onClick={() => onComplete(task.id)}
                  aria-label={`Mark ${task.title} complete`}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    lineHeight: 1,
                    color: "var(--state-completed)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </button>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <button
              onClick={() => { window.location.hash = "#/tasks"; }}
              style={{
                padding: "0.45rem 0.8rem",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                cursor: "pointer",
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              +{hiddenCount} more in queue — open Tasks to view all
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default FocusQueue;
