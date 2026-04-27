import { useEffect, useRef, useState } from "react";
import type { Task, TaskId } from "@shared/types";

import { APP_STORAGE_KEYS } from "../../app/appStorage";

const FOCUS_PREFILL_KEY = APP_STORAGE_KEYS.focusPrefill;

export interface FocusPanelProps {
  isActive: boolean;
  onStart: (minutes: number) => void;
  tasks?: Task[];
  onTaskSelect?: (taskId: TaskId | null) => void;
}

// Sorted by duration: short → medium → long
const PRESETS = [
  { label: "15m", minutes: 15 },
  { label: "25m", minutes: 25 },
  { label: "50m", minutes: 50 },
];

export function FocusPanel({
  isActive,
  onStart,
  tasks = [],
  onTaskSelect,
}: FocusPanelProps): JSX.Element {
  const [selected, setSelected] = useState<number>(25);
  const [customMinutes, setCustomMinutes] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefill(localStorage.getItem(FOCUS_PREFILL_KEY));
  }, []);

  useEffect(() => {
    if (!prefill || selectedTaskId !== null) {
      return;
    }
    const matchedTask = tasks.find(
      (task) =>
        !task.done &&
        task.title.trim().toLowerCase() === prefill.trim().toLowerCase(),
    );
    if (!matchedTask) {
      return;
    }
    setSelectedTaskId(matchedTask.id);
    onTaskSelect?.(matchedTask.id);
  }, [onTaskSelect, prefill, selectedTaskId, tasks]);

  // Close picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setTaskPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedTask =
    selectedTaskId === null
      ? null
      : (tasks.find((task) => task.id === selectedTaskId) ?? null);

  const pendingTasks = tasks.filter((t) => !t.done);

  return (
    <section
      style={{
        padding: "1.1rem 1.15rem",
        background:
          "linear-gradient(155deg, color-mix(in srgb, var(--surface) 88%, white 12%), var(--surface))",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "1rem",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "grid", gap: "0.22rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Focus Block</strong>
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Pick one target, choose a duration that matches your energy, and start
          without negotiating with the list again.
        </span>
      </div>
      {/* Title + task link row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        {/* Task picker */}
        {pendingTasks.length > 0 && (
          <div
            ref={pickerRef}
            style={{ position: "relative", flex: 1, minWidth: "160px" }}
          >
            <button
              onClick={() => !isActive && setTaskPickerOpen((v) => !v)}
              disabled={isActive}
              aria-label="Link session to a task"
              style={{
                width: "100%",
                padding: "0.4rem 0.75rem",
                borderRadius: "10px",
                border: "1px solid",
                borderColor: selectedTask
                  ? "color-mix(in srgb, var(--accent) 35%, transparent)"
                  : "var(--border-subtle)",
                background: selectedTask
                  ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                  : "var(--surface-2)",
                color: selectedTask ? "var(--text)" : "var(--text-secondary)",
                cursor: isActive ? "default" : "pointer",
                fontSize: "var(--text-sm)",
                fontWeight: selectedTask ? 600 : 400,
                textAlign: "left",
                opacity: isActive ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedTask ? selectedTask.title : "Choose a task…"}
              </span>
              {selectedTask ? (
                <span
                  role="button"
                  aria-label="Clear task selection"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTaskId(null);
                    onTaskSelect?.(null);
                    setPrefill(null);
                    localStorage.removeItem(FOCUS_PREFILL_KEY);
                  }}
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  ×
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  ▾
                </span>
              )}
            </button>

            {taskPickerOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "14px",
                  boxShadow:
                    "var(--shadow-floating, 0 8px 32px rgba(0,0,0,0.18))",
                  padding: "0.4rem",
                  maxHeight: "240px",
                  overflowY: "auto",
                  display: "grid",
                  gap: "0.2rem",
                }}
              >
                <button
                  onClick={() => {
                    setSelectedTaskId(null);
                    onTaskSelect?.(null);
                    setTaskPickerOpen(false);
                  }}
                  style={{
                    padding: "0.45rem 0.65rem",
                    borderRadius: "8px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                    textAlign: "left",
                  }}
                >
                  No task
                </button>
                {pendingTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      onTaskSelect?.(task.id);
                      setTaskPickerOpen(false);
                    }}
                    style={{
                      padding: "0.5rem 0.65rem",
                      borderRadius: "8px",
                      border:
                        selectedTaskId === task.id
                          ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)"
                          : "1px solid transparent",
                      background:
                        selectedTaskId === task.id
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "transparent",
                      cursor: "pointer",
                      fontSize: "var(--text-sm)",
                      fontWeight: selectedTaskId === task.id ? 600 : 400,
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {prefill && !isActive && !selectedTask && (
          <button
            onClick={() => {
              localStorage.removeItem(FOCUS_PREFILL_KEY);
              setPrefill(null);
            }}
            title="Clear suggested task"
            style={{
              padding: "0.3rem 0.7rem",
              borderRadius: "8px",
              border:
                "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              color: "var(--accent)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {prefill} ×
          </button>
        )}
      </div>

      {/* Duration presets + custom + start */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {PRESETS.map(({ label, minutes }) => (
            <button
              key={minutes}
              onClick={() => {
                setSelected(minutes);
                setCustomMinutes("");
              }}
              disabled={isActive}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid",
                borderColor:
                  selected === minutes && customMinutes === ""
                    ? "var(--accent)"
                    : "var(--border-subtle)",
                background:
                  selected === minutes && customMinutes === ""
                    ? "var(--accent)"
                    : "transparent",
                color:
                  selected === minutes && customMinutes === ""
                    ? "var(--text-inverted)"
                    : "var(--text-secondary)",
                cursor: isActive ? "default" : "pointer",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                opacity: isActive ? 0.5 : 1,
              }}
            >
              {label}
            </button>
          ))}
          <input
            type="number"
            min="1"
            max="180"
            placeholder="custom"
            value={customMinutes}
            onChange={(e) => {
              setCustomMinutes(e.target.value);
              if (e.target.value && !isNaN(Number(e.target.value))) {
                setSelected(Number(e.target.value));
              }
            }}
            disabled={isActive}
            aria-label="Custom duration in minutes"
            style={{
              padding: "0.4rem 0.6rem",
              borderRadius: "8px",
              border: "1px solid",
              borderColor:
                customMinutes !== "" ? "var(--accent)" : "var(--border-subtle)",
              background:
                customMinutes !== ""
                  ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                  : "transparent",
              color: "var(--text-primary)",
              cursor: isActive ? "default" : "pointer",
              fontSize: "var(--text-sm)",
              opacity: isActive ? 0.5 : 1,
              width: "76px",
              textAlign: "center",
            }}
          />
        </div>

        <button
          onClick={() => {
            localStorage.removeItem(FOCUS_PREFILL_KEY);
            setPrefill(null);
            onStart(selected);
          }}
          disabled={isActive}
          style={{
            padding: "0.5rem 1.4rem",
            borderRadius: "10px",
            border: "none",
            background: isActive
              ? "var(--border-subtle)"
              : "linear-gradient(155deg, color-mix(in srgb, var(--accent) 80%, white 20%), var(--accent))",
            color: isActive ? "var(--text-secondary)" : "var(--text-inverted)",
            cursor: isActive ? "default" : "pointer",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            marginLeft: "auto",
            boxShadow: isActive ? "none" : "var(--shadow-soft)",
          }}
        >
          {isActive ? "Session active" : "Start Focus"}
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {selectedTask ? (
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--accent)",
              padding: "0.22rem 0.55rem",
              borderRadius: "999px",
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
            }}
          >
            linked to {selectedTask.title}
          </span>
        ) : (
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              padding: "0.22rem 0.55rem",
              borderRadius: "999px",
              background: "var(--surface-2)",
            }}
          >
            no task linked yet
          </span>
        )}
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            padding: "0.22rem 0.55rem",
            borderRadius: "999px",
            background: "var(--surface-2)",
          }}
        >
          {selected} minute block
        </span>
      </div>
    </section>
  );
}

export default FocusPanel;
