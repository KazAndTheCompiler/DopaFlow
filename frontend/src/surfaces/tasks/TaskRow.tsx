import { useContext, useRef, useState } from "react";
import type { Task } from "../../../../shared/types";
import { AppDataContext } from "../../App";
import { startTaskTimer, stopTaskTimer } from "../../api/tasks";
import { showToast } from "../../design-system/primitives/Toast";

const PRIORITY_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "P1", color: "var(--state-overdue)", bg: "var(--state-overdue)14" },
  2: { label: "P2", color: "var(--state-warn)", bg: "var(--state-warn)14" },
  3: { label: "P3", color: "var(--text-secondary)", bg: "var(--surface-2)" },
  4: { label: "P4", color: "var(--text-secondary)", bg: "var(--surface-2)" },
  5: { label: "P5", color: "var(--text-secondary)", bg: "var(--surface-2)" },
};

const STATUS_OPACITY: Record<string, number> = {
  done: 0.45,
  cancelled: 0.3,
  in_progress: 1,
  todo: 1,
};

export interface TaskRowProps {
  task: Task;
  onComplete?: ((id: string) => void) | undefined;
  onEdit?: ((task: Task) => void) | undefined;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button, input, select, textarea, a, [role='button']"));
}

export function TaskRow({ task, onComplete, onEdit, selected = false, onToggleSelect }: TaskRowProps): JSX.Element {
  const ctx = useContext(AppDataContext);
  const project = task.project_id ? (ctx?.projects.projects ?? []).find((p) => p.id === task.project_id) : null;
  const prio = PRIORITY_LABELS[task.priority] ?? { label: "P?", color: "var(--border-subtle)", bg: "var(--surface-2)" };
  const opacity = STATUS_OPACITY[task.status] ?? 1;
  const isDone = task.status === "done" || task.done;
  const [isHovered, setIsHovered] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [tracking, setTracking] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeMode = useRef<"idle" | "horizontal" | "vertical">("idle");
  const swipeEnabled = useRef(false);
  const SWIPE_THRESHOLD = 72;
  const SWIPE_LOCK_THRESHOLD = 12;
  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const dueTone = dueDate && !isDone
    ? dueDate.getTime() < Date.now()
      ? { label: "Overdue", color: "var(--state-overdue)", bg: "color-mix(in srgb, var(--state-overdue) 10%, transparent)" }
      : { label: dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }), color: "var(--text-secondary)", bg: "var(--surface-2)" }
    : null;

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCompleting(true);
    setTimeout(() => onComplete?.(task.id), 300);
  };

  const handleToggleTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (tracking) {
        await stopTaskTimer(task.id);
        setTracking(false);
      } else {
        await startTaskTimer(task.id);
        setTracking(true);
      }
    } catch {
      showToast("Timer toggle failed.", "error");
    }
  };

  const resetSwipe = () => {
    setSwipeX(0);
    swipeMode.current = "idle";
    swipeEnabled.current = false;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onComplete || isDone || isInteractiveTarget(e.target)) {
      resetSwipe();
      return;
    }

    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeMode.current = "idle";
    swipeEnabled.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!swipeEnabled.current) {
      return;
    }

    const delta = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    if (swipeMode.current === "idle") {
      if (Math.abs(delta) < SWIPE_LOCK_THRESHOLD && Math.abs(deltaY) < SWIPE_LOCK_THRESHOLD) {
        return;
      }
      swipeMode.current = Math.abs(delta) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (swipeMode.current === "vertical") {
      setSwipeX(0);
      return;
    }

    if (delta > 0) {
      setSwipeX(Math.min(delta, SWIPE_THRESHOLD + 18));
    } else {
      setSwipeX(0);
    }
  };

  const onTouchEnd = () => {
    if (swipeEnabled.current && swipeMode.current === "horizontal" && swipeX >= SWIPE_THRESHOLD && onComplete && !isDone) {
      setIsCompleting(true);
      setTimeout(() => onComplete(task.id), 250);
    }
    resetSwipe();
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "14px", marginBottom: "8px" }}>
      {/* Swipe reveal underlay */}
      {swipeX > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--state-ok)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1rem",
            borderRadius: "14px",
            opacity: Math.min(swipeX / SWIPE_THRESHOLD, 1),
          }}
        >
          <span style={{ color: "white", fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.04em" }}>
            {swipeX >= SWIPE_THRESHOLD ? "Release to complete" : "Swipe to complete"}
          </span>
          <span style={{ color: "white", fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.04em" }}>OK</span>
        </div>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={resetSwipe}
        style={{
          display: "grid",
          gridTemplateColumns: "24px auto minmax(0, 1fr) auto",
          gap: "0.75rem",
          padding: "0.8rem 0.85rem",
          border: "1px solid var(--border-subtle)",
          opacity: isCompleting ? 0 : opacity,
          alignItems: "center",
          boxShadow: isHovered || selected ? "var(--shadow-soft)" : "none",
          transform: swipeX !== 0 ? `translateX(${swipeX}px)` : isHovered ? "translateY(-1px)" : "none",
          transition: swipeX !== 0 ? "none" : "box-shadow 180ms ease, transform 180ms ease, opacity 180ms ease",
          borderRadius: "14px",
          marginBottom: "2px",
          background: isHovered || selected
            ? "linear-gradient(145deg, color-mix(in srgb, var(--surface) 76%, white 24%), var(--surface))"
            : "color-mix(in srgb, var(--surface) 92%, white 8%)",
          touchAction: "pan-y",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${task.title}`}
            style={{
              width: "16px",
              height: "16px",
              cursor: "pointer",
              opacity: isHovered || selected ? 1 : 0.3,
              transition: "opacity 180ms ease",
            }}
          />
        )}

        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 800,
            color: prio.color,
            textAlign: "center",
            background: prio.bg,
            borderRadius: "999px",
            padding: "0.2rem 0.45rem",
            minWidth: "34px",
          }}
          title={`Priority ${task.priority}`}
        >
          {prio.label}
        </span>

        <div
          style={{ minWidth: 0, cursor: onEdit ? "pointer" : "default" }}
          onClick={() => onEdit?.(task)}
          role={onEdit ? "button" : undefined}
          tabIndex={onEdit ? 0 : undefined}
          onKeyDown={(e) => {
            if (onEdit && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onEdit(task);
            }
          }}
          aria-label={onEdit ? `Edit task: ${task.title}` : undefined}
        >
          <span
            style={{
              display: "block",
              fontWeight: 700,
              textDecoration: isDone ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </span>
          {(task.tags.length > 0 || dueTone || task.description || project) && (
            <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
              {project && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "var(--text-xs)", color: "var(--text-muted)", padding: "0.18rem 0.48rem", borderRadius: "999px", background: "var(--surface-2)", border: `1px solid ${project.color || "var(--border)"}40` }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: project.color || "var(--accent)", display: "inline-block" }} />
                  {project.name}
                </span>
              )}
              {dueTone && (
                <span style={{ fontSize: "var(--text-xs)", color: dueTone.color, padding: "0.18rem 0.48rem", borderRadius: "999px", background: dueTone.bg }}>
                  {dueTone.label}
                </span>
              )}
              {task.description && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", padding: "0.18rem 0.48rem", borderRadius: "999px", background: "var(--surface-2)" }} title={task.description}>Note</span>
              )}
              {task.tags.map((tag) => (
                <span key={tag} style={{ fontSize: "var(--text-xs)", color: "var(--accent)", padding: "0.18rem 0.48rem", borderRadius: "999px", background: "var(--accent)12" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", justifySelf: "end", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              padding: "0.2rem 0.5rem",
              borderRadius: "999px",
              background: "var(--surface-2)",
              textTransform: "capitalize",
            }}
          >
            {task.status.replace("_", " ")}
          </span>

          <button
            onClick={handleToggleTimer}
            aria-label={tracking ? `Stop timer for ${task.title}` : `Start timer for ${task.title}`}
            style={{
              minWidth: "42px",
              height: "30px",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)",
              background: tracking ? "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))" : "var(--surface-2)",
              cursor: "pointer",
              color: tracking ? "white" : "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.63rem",
              fontWeight: 800,
              transition: "background 180ms ease, color 180ms ease",
              padding: "0 0.55rem",
            }}
          >
            {tracking ? "Stop" : "TM"}
          </button>

          {!isDone && onComplete && (
            <button
              onClick={handleComplete}
              aria-label={`Complete ${task.title}`}
              style={{
                minWidth: "42px",
                height: "30px",
                borderRadius: "10px",
                border: "1.5px solid var(--border-subtle)",
                background: "var(--surface-2)",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.68rem",
                fontWeight: 800,
                transition: "background 180ms ease, transform 180ms ease",
                padding: "0 0.55rem",
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskRow;
