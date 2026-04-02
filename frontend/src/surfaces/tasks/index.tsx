import { useContext, useEffect, useState } from "react";

import type { Task } from "../../../../shared/types";
import { AppDataContext } from "../../App";
import EisenhowerView from "./EisenhowerView";
import KanbanView from "./KanbanView";
import TaskCreateBar from "./TaskCreateBar";
import TaskEditModal from "./TaskEditModal";
import TaskFilterBar from "./TaskFilterBar";
import TasksPanel from "./TasksPanel";

interface TasksViewProps {
  initialView?: "list" | "board";
}

type BoardMode = "kanban" | "eisenhower";

const viewToggleStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.35rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid",
  borderColor: active ? "var(--accent)" : "var(--border-subtle)",
  background: active ? "var(--accent)" : "transparent",
  color: active ? "var(--text-inverted)" : "var(--text-secondary)",
  cursor: "pointer",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
});

export default function TasksView({ initialView = "list" }: TasksViewProps): JSX.Element {
  const app = useContext(AppDataContext);
  const [quadrants, setQuadrants] = useState<{ q1: []; q2: []; q3: []; q4: [] }>({ q1: [], q2: [], q3: [], q4: [] });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [boardMode, setBoardMode] = useState<BoardMode>("kanban");

  if (!app) return <div>App context unavailable.</div>;

  const isBoard = initialView === "board";
  const activeProjectId = app.projects?.activeProjectId ?? null;
  const visibleTasks = activeProjectId
    ? app.tasks.filteredTasks.filter((t) => t.project_id === activeProjectId)
    : app.tasks.filteredTasks;
  const activeProject = activeProjectId
    ? (app.projects?.projects ?? []).find((p) => p.id === activeProjectId)
    : null;

  useEffect(() => {
    if (!isBoard || boardMode !== "eisenhower") return;
    void fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v2"}/boards/eisenhower`)
      .then((r) => r.json())
      .then((body) => setQuadrants(body))
      .catch(() => setQuadrants({ q1: [], q2: [], q3: [], q4: [] }));
  }, [isBoard, boardMode, app.tasks.tasks]);

  if (isBoard) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "1.1rem" }}>Board</strong>
          <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto" }}>
            <button style={viewToggleStyle(boardMode === "kanban")} onClick={() => setBoardMode("kanban")}>
              Kanban
            </button>
            <button style={viewToggleStyle(boardMode === "eisenhower")} onClick={() => setBoardMode("eisenhower")}>
              Eisenhower
            </button>
          </div>
        </div>
        <TaskCreateBar
          onCreate={async (text) => {
            await app.tasks.createDraftTask(text);
            await app.tasks.refresh();
          }}
        />
        {boardMode === "kanban" ? (
          <KanbanView
            tasks={app.tasks.tasks}
            onEdit={(task) => setEditingTask(task)}
            onStatusChange={(id, status) => void app.tasks.update(id, { status })}
          />
        ) : (
          <EisenhowerView quadrants={quadrants} />
        )}
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={async (id, patch) => { await app.tasks.update(id, patch); }}
          onDelete={async (id) => { await app.tasks.remove(id); }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <TaskCreateBar
        onCreate={async (text) => {
          const task = await app.tasks.createDraftTask(text);
          if (activeProjectId && task && typeof task === "object" && "id" in task) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            await app.tasks.update(task.id as string, { project_id: activeProjectId } as Partial<Task>);
          }
          await app.tasks.refresh();
        }}
      />
      {activeProject && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.75rem", borderRadius: "10px", background: "var(--surface-2)", fontSize: "var(--text-sm)" }}>
          <span>{activeProject.icon || "PR"}</span>
          <span style={{ fontWeight: 600 }}>{activeProject.name}</span>
          <button
            onClick={() => app.projects?.setActiveProjectId(null)}
            style={{ marginLeft: "auto", border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "var(--text-xs)" }}
          >
            Clear filter X
          </button>
        </div>
      )}
      <TaskFilterBar
        total={visibleTasks.length}
        filters={app.tasks.filters}
        onFilterChange={app.tasks.setFilters}
        sortBy={app.tasks.sortBy}
        onSortByChange={(sortBy) => { app.tasks.setSortBy(sortBy); void app.tasks.refresh(); }}
      />
      <TasksPanel
        tasks={visibleTasks}
        loading={app.tasks.loading}
        onComplete={(id) => void app.tasks.complete(id)}
        onEdit={(task) => setEditingTask(task)}
        selectedIds={app.tasks.selectedIds}
        onToggleSelect={app.tasks.toggleSelect}
        onBulkComplete={(ids) => app.tasks.bulkComplete(ids)}
        onBulkDelete={(ids) => app.tasks.bulkDelete(ids)}
        onClearSelection={app.tasks.clearSelection}
      />
      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (id, patch) => { await app.tasks.update(id, patch); }}
        onDelete={async (id) => { await app.tasks.remove(id); }}
      />
    </div>
  );
}
