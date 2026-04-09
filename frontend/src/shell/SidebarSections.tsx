import { useState } from "react";

import type { Project } from "../../../shared/types";
import type { SidebarItem } from "./Sidebar";

export function NavButton({
  item,
  activeRoute,
  collapsed,
  onNavigate,
}: {
  item: SidebarItem;
  activeRoute: string;
  collapsed: boolean;
  onNavigate: (route: string) => void;
}): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = item.id === activeRoute;

  return (
    <button
      key={item.id}
      onClick={() => onNavigate(item.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        width: "100%",
        border: 0,
        borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
        background: isActive
          ? "linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), color-mix(in srgb, var(--surface) 84%, white 16%))"
          : isHovered
            ? "color-mix(in srgb, var(--surface) 76%, white 24%)"
            : "transparent",
        padding: "0.8rem 0.85rem",
        borderRadius: "0 16px 16px 0",
        cursor: "pointer",
        boxShadow: isHovered || isActive ? "var(--shadow-soft)" : "none",
        transform: isHovered && !isActive ? "translateX(2px)" : "none",
        transition: "box-shadow 180ms ease, transform 180ms ease, background 180ms ease, border-color 180ms ease",
      }}
    >
      <span
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "10px",
          display: "grid",
          placeItems: "center",
          background: isActive ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "color-mix(in srgb, var(--surface) 74%, white 26%)",
          color: isActive ? "var(--accent)" : "var(--text-secondary)",
          fontSize: "0.95rem",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {item.icon}
      </span>
      <span
        style={{
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : 160,
          overflow: "hidden",
          whiteSpace: "nowrap",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: isActive ? 700 : 600,
          transition: "opacity 140ms ease, max-width 180ms ease",
        }}
      >
        {item.label}
      </span>
    </button>
  );
}

export function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <>
      <div
        style={{
          display: "grid",
          gap: "0.55rem",
          padding: collapsed ? "0 0.25rem 0.9rem" : "0 0.45rem 0.95rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: "0.65rem",
          }}
        >
          {!collapsed && (
            <div style={{ display: "grid", gap: "0.1rem" }}>
              <strong style={{ fontSize: "0.95rem", letterSpacing: "0.04em" }}>DopaFlow</strong>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Daily systems
              </span>
            </div>
          )}
          {collapsed && (
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "12px",
                background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 22%, var(--surface)), color-mix(in srgb, var(--surface) 82%, white 18%))",
                color: "var(--accent)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
              }}
            >
              D
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onToggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          marginBottom: "1rem",
          width: collapsed ? "34px" : "100%",
          border: "none",
          background: collapsed ? "color-mix(in srgb, var(--surface) 74%, white 26%)" : "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontSize: "0.95rem",
          padding: "0.55rem",
          borderRadius: "12px",
          textAlign: collapsed ? "center" : "right",
          transition: "color 150ms ease, background 150ms ease",
          alignSelf: collapsed ? "center" : undefined,
        }}
      >
        {collapsed ? "›" : "‹"}
      </button>
    </>
  );
}

export function SidebarProjectList({
  collapsed,
  projects,
  projectTaskCounts,
  activeProjectId,
  onProjectSelect,
}: {
  collapsed: boolean;
  projects: Project[];
  projectTaskCounts: Record<string, number>;
  activeProjectId: string | null;
  onProjectSelect: (id: string | null) => void;
}): JSX.Element | null {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border-subtle)" }}>
      {!collapsed && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0.75rem 0.35rem" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Projects
          </span>
          {activeProjectId && (
            <button
              onClick={() => onProjectSelect(null)}
              style={{ border: "none", background: "none", color: "var(--text-muted)", fontSize: "var(--text-xs)", cursor: "pointer", padding: 0 }}
            >
              All
            </button>
          )}
        </div>
      )}
      {projects.filter((project) => !project.archived).map((project) => {
        const isActive = activeProjectId === project.id;
        const count = projectTaskCounts[project.id] ?? 0;
        return (
          <button
            key={project.id}
            onClick={() => onProjectSelect(isActive ? null : project.id)}
            title={project.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              width: "100%",
              border: 0,
              borderLeft: isActive ? `3px solid ${project.color || "var(--accent)"}` : "3px solid transparent",
              background: isActive ? "color-mix(in srgb, var(--surface) 76%, white 24%)" : "transparent",
              padding: "0.6rem 0.75rem",
              borderRadius: "0 12px 12px 0",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 150ms ease, transform 150ms ease",
            }}
          >
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>{project.icon || "PR"}</span>
            {!collapsed && (
              <>
                <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {project.name}
                </span>
                {count > 0 && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", background: "var(--surface-2)", borderRadius: "999px", padding: "1px 6px" }}>
                    {count}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
