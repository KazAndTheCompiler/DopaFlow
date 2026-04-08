import { useContext, useEffect, useMemo, useState } from "react";

import type { Task } from "../../../../shared/types";
import { AppDataContext } from "../../App";
import EisenhowerView from "./EisenhowerView";
import KanbanView from "./KanbanView";
import TaskCreateBar from "./TaskCreateBar";
import TaskEditModal from "./TaskEditModal";
import TaskFilterBar from "./TaskFilterBar";
import TasksPanel from "./TasksPanel";
import { apiClient } from "../../api/client";

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
  const doneCount = visibleTasks.filter((task) => task.done || task.status === "done").length;
  const activeCount = visibleTasks.filter((task) => !task.done && task.status !== "done" && task.status !== "cancelled").length;
  const overdueCount = visibleTasks.filter((task) => !task.done && Boolean(task.due_at) && new Date(task.due_at as string).getTime() < Date.now()).length;

  const compactStats = useMemo(
    () => [
      { label: "Active", value: activeCount, tone: "var(--accent)", detail: "ready to move" },
      { label: "Done", value: doneCount, tone: "var(--state-ok)", detail: "already closed" },
      { label: "Overdue", value: overdueCount, tone: overdueCount > 0 ? "var(--state-overdue)" : "var(--text-secondary)", detail: overdueCount > 0 ? "needs triage" : "under control" },
    ],
    [activeCount, doneCount, overdueCount],
  );

  useEffect(() => {
    if (!isBoard || boardMode !== "eisenhower") return;
    void apiClient<{ q1: []; q2: []; q3: []; q4: [] }>("/boards/eisenhower")
      .then((body) => setQuadrants(body))
      .catch(() => setQuadrants({ q1: [], q2: [], q3: [], q4: [] }));
  }, [isBoard, boardMode, app.tasks.tasks]);

  if (isBoard) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <section
          style={{
            padding: "1.05rem 1.15rem",
            borderRadius: "22px",
            background: "linear-gradient(150deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), color-mix(in srgb, var(--surface) 96%, black 4%))",
            border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
            display: "grid",
            gap: "0.95rem",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "start", gap: "0.85rem", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "0.28rem", maxWidth: "72ch" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
                Board workflow
              </span>
              <strong style={{ fontSize: "var(--text-xl)" }}>Move work visually instead of auditing a long list</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Use Kanban to keep execution flowing, or switch to Eisenhower when the real problem is prioritization rather than volume.
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {compactStats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    minWidth: "112px",
                    padding: "0.7rem 0.8rem",
                    borderRadius: "16px",
                    background: "color-mix(in srgb, var(--surface) 92%, transparent)",
                    backdropFilter: "var(--surface-glass-blur, blur(14px))",
                    border: "1px solid var(--border-subtle)",
                    display: "grid",
                    gap: "0.08rem",
                    position: "relative",
                  }}
                >
                  <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
                  <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
                  <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
                  <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    {stat.label}
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: stat.tone }}>{stat.value}</strong>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{stat.detail}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "1.02rem" }}>Board mode</strong>
            <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto" }}>
            <button style={viewToggleStyle(boardMode === "kanban")} onClick={() => setBoardMode("kanban")}>
              Kanban
            </button>
            <button style={viewToggleStyle(boardMode === "eisenhower")} onClick={() => setBoardMode("eisenhower")}>
              Eisenhower
            </button>
          </div>
          </div>
        </section>
        <TaskCreateBar
          onCreate={async (text) => {
            await app.tasks.createQuickTask(text);
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
      <section
        style={{
          padding: "1.05rem 1.15rem",
          borderRadius: "22px",
          background: "linear-gradient(150deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), color-mix(in srgb, var(--surface) 96%, black 4%))",
          border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
          display: "grid",
          gap: "0.95rem",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.85rem", alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "0.28rem", maxWidth: "72ch" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Task runway
            </span>
            <strong style={{ fontSize: "var(--text-xl)" }}>Capture quickly, then cut the list down to what should actually move</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              This surface should help you offload ideas fast, filter the noise, and leave only the tasks that deserve attention right now.
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {compactStats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  minWidth: "112px",
                  padding: "0.7rem 0.8rem",
                  borderRadius: "16px",
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "grid",
                  gap: "0.08rem",
                }}
              >
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  {stat.label}
                </span>
                <strong style={{ fontSize: "1.2rem", color: stat.tone }}>{stat.value}</strong>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{stat.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <TaskCreateBar
        onVoiceExecuted={() => {
          void app.tasks.refresh();
        }}
        onCreate={async (text) => {
          const task = await app.tasks.createQuickTask(text);
          if (activeProjectId) {
            await app.tasks.update(task.id, { project_id: activeProjectId } as Partial<Task>);
          }
          await app.tasks.refresh();
        }}
      />
      {activeProject && (
        <div           style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 0.8rem", borderRadius: "14px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", fontSize: "var(--text-sm)", boxShadow: "var(--shadow-soft)", position: "relative" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
          <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
          <span>{activeProject.icon || "PR"}</span>
          <span style={{ fontWeight: 600 }}>{activeProject.name}</span>
          <span style={{ color: "var(--text-secondary)" }}>project filter active</span>
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
        onSortByChange={app.tasks.setSortBy}
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
