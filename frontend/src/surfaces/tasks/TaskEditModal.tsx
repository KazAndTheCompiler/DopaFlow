import { useEffect, useState } from "react";

import Button from "@ds/primitives/Button";
import Input from "@ds/primitives/Input";
import Modal from "@ds/primitives/Modal";
import type { ProjectId, SubTask, Task } from "@shared/types";
import { askPacky, createAlarm } from "@api/index";
import { useAppProjects, useAppTasks } from "../../app/AppContexts";

export interface TaskEditModalProps {
  task: Task | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const STATUSES: Task["status"][] = ["todo", "in_progress", "done", "cancelled"];
const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const RECURRENCE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "No repeat", value: "" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

type TaskEditSnapshot = {
  title: string;
  description: string;
  priority: number;
  status: Task["status"];
  dueAt: string;
  tagsRaw: string;
  estimatedMinutes: string;
  subtasks: SubTask[];
  recurrenceRule: string;
  projectId: string;
  dependencies: string[];
  reminderEnabled: boolean;
  reminderOffset: number;
};

export default function TaskEditModal({ task, onClose, onSave, onDelete }: TaskEditModalProps): JSX.Element | null {
  const projects = useAppProjects();
  const tasks = useAppTasks();
  const availableProjects = projects.projects;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [dueAt, setDueAt] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dependencies, setDependencies] = useState<Task[]>([]);
  const [depSearch, setDepSearch] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderOffset, setReminderOffset] = useState<number>(0);
  const [packyHint, setPackyHint] = useState<string>("");
  const [initialSnapshot, setInitialSnapshot] = useState<TaskEditSnapshot | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!task) {
 setDependencies([]); return;
}
    void tasks.getContext(task.id)
      .then((ctx) => {
        const nextDependencies = ctx.dependencies ?? [];
        setDependencies(nextDependencies);
        setInitialSnapshot((prev) => {
          if (!prev) {
 return prev;
}
          return { ...prev, dependencies: nextDependencies.map((dep) => dep.id) };
        });
      })
      .catch(() => setDependencies([]));
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!task) {
 return;
}
    setPackyHint("");
    void askPacky({ text: `Task: "${task.title}". One concrete tip to move this forward.`, context: { route: "tasks" } })
      .then((r) => setPackyHint(r.reply_text))
      .catch(() => setPackyHint(""));
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!task) {
 return;
}
    const nextSnapshot: TaskEditSnapshot = {
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status,
      dueAt: task.due_at ? task.due_at.slice(0, 10) : "",
      tagsRaw: task.tags.join(", "),
      estimatedMinutes: task.estimated_minutes != null ? String(task.estimated_minutes) : "",
      subtasks: task.subtasks ?? [],
      recurrenceRule: task.recurrence_rule ?? "",
      projectId: task.project_id ?? "",
      dependencies: [],
      reminderEnabled: false,
      reminderOffset: 0,
    };
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setStatus(task.status);
    setDueAt(task.due_at ? task.due_at.slice(0, 10) : "");
    setTagsRaw(task.tags.join(", "));
    setEstimatedMinutes(task.estimated_minutes != null ? String(task.estimated_minutes) : "");
    setSubtasks(task.subtasks ?? []);
    setRecurrenceRule(task.recurrence_rule ?? "");
    setProjectId(task.project_id ?? "");
    setNewSubtaskTitle("");
    setConfirmDelete(false);
    setReminderEnabled(false);
    setReminderOffset(0);
    setInitialSnapshot(nextSnapshot);
    setIsDirty(false);
  }, [task]);

  useEffect(() => {
    if (!task || !initialSnapshot) {
 return;
}
    const nextSnapshot: TaskEditSnapshot = {
      title,
      description,
      priority,
      status,
      dueAt,
      tagsRaw,
      estimatedMinutes,
      subtasks,
      recurrenceRule,
      projectId,
      dependencies: dependencies.map((dep) => dep.id),
      reminderEnabled,
      reminderOffset,
    };
    setIsDirty(JSON.stringify(nextSnapshot) !== JSON.stringify(initialSnapshot));
  }, [
    dependencies,
    description,
    dueAt,
    estimatedMinutes,
    initialSnapshot,
    priority,
    projectId,
    recurrenceRule,
    reminderEnabled,
    reminderOffset,
    status,
    subtasks,
    tagsRaw,
    task,
    title,
  ]);

  if (!task) {
 return null;
}

  const handleRequestClose = (): void => {
    if (isDirty && !window.confirm("Discard changes?")) {
 return;
}
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
 return;
}
      event.preventDefault();
      handleRequestClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, onClose]);

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) {
 return;
}
    setSaving(true);
    try {
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const patch: Partial<Task> = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        due_at: dueAt || null,
        tags,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        subtasks,
      };
      if (projectId) {
        patch.project_id = projectId as ProjectId;
      }
      if (recurrenceRule) {
        patch.recurrence_rule = recurrenceRule;
      }
      await onSave(task.id, patch);
      if (reminderEnabled && dueAt) {
        const dueDate = new Date(dueAt);
        dueDate.setHours(23, 59, 0, 0);
        const fireAt = new Date(dueDate.getTime() - reminderOffset * 60_000);
        await createAlarm({
          title: title.trim(),
          at: fireAt.toISOString(),
          kind: "tts",
          tts_text: `Reminder: ${title.trim()}`,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(task.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "0.3rem",
    display: "block",
  };

  const textarea: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem 0.9rem",
    borderRadius: "14px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    outline: "none",
    resize: "vertical",
    minHeight: "80px",
    fontFamily: "inherit",
    fontSize: "inherit",
    boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem 0.9rem",
    borderRadius: "14px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    outline: "none",
    fontFamily: "inherit",
    fontSize: "inherit",
  };

  const sectionCard: React.CSSProperties = {
    padding: "0.95rem 1rem",
    borderRadius: "16px",
    border: "1px solid var(--border-subtle)",
    background: "color-mix(in srgb, var(--surface) 80%, white 20%)",
    display: "grid",
    gap: "0.9rem",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "var(--text-xs)",
    color: "var(--accent)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 800,
    margin: 0,
  };

  return (
    <Modal open={true} title="Edit task" onClose={handleRequestClose}>
      <div style={{ display: "grid", gap: "1rem" }}>
        {packyHint && (
          <div
            style={{
              padding: "0.65rem 0.9rem",
              borderRadius: "12px",
              background: "var(--accent)12",
              border: "1px solid var(--accent)30",
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--accent)" }}>Packy · </span>{packyHint}
          </div>
        )}
        <div style={sectionCard}>
          <p style={sectionTitle}>Core</p>
          <label style={fieldLabel}>Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
 if (e.key === "Enter") {
 void handleSave();
}
}}
            autoFocus
          />
          <label style={fieldLabel}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Add more detail..."
            style={textarea}
          />
        </div>

        <div style={sectionCard}>
          <p style={sectionTitle}>Scheduling</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={fieldLabel}>Priority</label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0",
                      borderRadius: "8px",
                      border: "1.5px solid",
                      borderColor: priority === p ? "var(--accent)" : "var(--border)",
                      background: priority === p ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                      color: priority === p ? "var(--accent)" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={fieldLabel}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.currentTarget.value as Task["status"])} style={selectStyle}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={fieldLabel}>Due date</label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.currentTarget.value)} />
            </div>
            <div>
              <label style={fieldLabel}>Estimated (min)</label>
              <Input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.currentTarget.value)}
                placeholder="e.g. 30"
                min="1"
              />
            </div>
          </div>

          <label style={fieldLabel}>Tags (comma-separated)</label>
          <Input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.currentTarget.value)}
            placeholder="e.g. work, urgent, health"
          />
        </div>

        {availableProjects.length > 0 && (
          <div style={sectionCard}>
            <p style={sectionTitle}>Project</p>
            <label style={fieldLabel}>Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.currentTarget.value)} style={selectStyle}>
              <option value="">No project</option>
              {availableProjects.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>{p.icon ? `${p.icon} ` : ""}{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={sectionCard}>
          <p style={sectionTitle}>Dependencies</p>
          <label style={fieldLabel}>Blocked by</label>
          {dependencies.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
              {dependencies.map((dep) => (
                <span
                  key={dep.id}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.55rem", borderRadius: "999px", background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}
                >
                  {dep.title}
                  <button
                    type="button"
                    onClick={() => void tasks.removeDependency(task.id, dep.id).then(() => setDependencies((ds) => ds.filter((d) => d.id !== dep.id)))}
                    style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, lineHeight: 1 }}
                  >
                    X
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              value={depSearch}
              onChange={(e) => setDepSearch(e.currentTarget.value)}
              placeholder="Search task to block on…"
              list={`dep-options-${task?.id}`}
              style={{ ...selectStyle, flex: 1 }}
            />
            <datalist id={`dep-options-${task?.id}`}>
              {tasks.tasks
                .filter((t) => t.id !== task?.id && !dependencies.some((d) => d.id === t.id) && t.title.toLowerCase().includes(depSearch.toLowerCase()))
                .slice(0, 10)
                .map((t) => <option key={t.id} value={t.title} data-id={t.id} />)}
            </datalist>
            <button
              type="button"
              onClick={() => {
                const match = tasks.tasks.find((t) => t.title === depSearch && t.id !== task?.id);
                if (!match || !task) {
 return;
}
                void tasks.addDependency(task.id, match.id).then(() => {
 setDependencies((ds) => [...ds, match]); setDepSearch("");
});
              }}
              style={{ padding: "0.65rem 0.8rem", borderRadius: "10px", border: "none", background: "var(--accent)", color: "var(--text-inverted)", cursor: "pointer", fontWeight: 600, fontSize: "var(--text-sm)" }}
            >
              Add
            </button>
          </div>
        </div>

        <div style={sectionCard}>
          <p style={sectionTitle}>Automation</p>
          <label style={fieldLabel}>Reminder</label>
          <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", cursor: "pointer", fontSize: "var(--text-sm)" }}>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.currentTarget.checked)}
                style={{ accentColor: "var(--accent)", cursor: "pointer" }}
              />
              Remind me
            </label>
            {reminderEnabled && (
              <select
                value={reminderOffset}
                onChange={(e) => setReminderOffset(Number(e.currentTarget.value))}
                style={selectStyle}
              >
              <option value={0}>At due time</option>
              <option value={15}>15 min before</option>
              <option value={30}>30 min before</option>
              <option value={60}>1 hour before</option>
              <option value={120}>2 hours before</option>
              </select>
            )}
            {reminderEnabled && !dueAt && (
              <span style={{ fontSize: "11px", color: "var(--state-warn)" }}>Set a due date to enable reminder</span>
            )}
          </div>
        </div>

        <div>
          <label style={fieldLabel}>Repeat</label>
          <select value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.currentTarget.value)} style={selectStyle}>
            {RECURRENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
              ))}
          </select>
        </div>

        <div style={sectionCard}>
          <p style={sectionTitle}>Breakdown</p>
          <label style={fieldLabel}>Subtasks</label>
          {subtasks.length > 0 && (
            <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.75rem" }}>
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem",
                    borderRadius: "8px",
                    background: "var(--surface-2)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={subtask.done}
                    onChange={(e) => {
                      setSubtasks(
                        subtasks.map((st) =>
                          st.id === subtask.id ? { ...st, done: e.currentTarget.checked } : st
                        )
                      );
                    }}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                  <span
                    style={{
                      flex: 1,
                      textDecoration: subtask.done ? "line-through" : "none",
                      color: subtask.done ? "var(--text-secondary)" : "var(--text)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.currentTarget.value)}
              placeholder="Add new subtask..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSubtaskTitle.trim()) {
                  const id = `tsk_${Date.now()}` as const;
                  setSubtasks([...subtasks, { id, title: newSubtaskTitle.trim(), done: false }]);
                  setNewSubtaskTitle("");
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (newSubtaskTitle.trim()) {
                  const id = `tsk_${Date.now()}` as const;
                  setSubtasks([...subtasks, { id, title: newSubtaskTitle.trim(), done: false }]);
                  setNewSubtaskTitle("");
                }
              }}
              disabled={!newSubtaskTitle.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
          <button
            onClick={() => void handleDelete()}
            disabled={saving}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: confirmDelete ? "var(--state-overdue)" : "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              padding: "0.25rem 0",
            }}
          >
            {confirmDelete ? "Tap again to confirm delete" : "Delete task"}
          </button>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="ghost" onClick={handleRequestClose} disabled={saving}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving || !title.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
