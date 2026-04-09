import type { PackyWhisper, Project } from "../../../shared/types";
import type { AppRoute } from "../appRoutes";
import type { SidebarItem } from "./Sidebar";

interface ShellMobileDrawerProps {
  route: AppRoute;
  navItems: SidebarItem[];
  projects: Project[];
  projectTaskCounts: Record<string, number>;
  activeProjectId: string | null;
  packyWhisper?: PackyWhisper | undefined;
  onNavigate: (route: AppRoute) => void;
  onProjectSelect: (id: string | null) => void;
  onClose: () => void;
}

export function ShellMobileDrawer({
  route,
  navItems,
  projects,
  projectTaskCounts,
  activeProjectId,
  packyWhisper,
  onNavigate,
  onProjectSelect,
  onClose,
}: ShellMobileDrawerProps): JSX.Element {
  const activeProjects = projects.filter((project) => !project.archived);

  return (
    <>
      <button
        aria-label="Close navigation menu"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          border: "none",
          background: "rgba(15, 18, 24, 0.34)",
          padding: 0,
          zIndex: 30,
        }}
      />
      <section
        aria-label="Mobile navigation drawer"
        data-testid="mobile-drawer"
        style={{
          position: "fixed",
          left: "0.75rem",
          right: "0.75rem",
          bottom: "4.6rem",
          maxHeight: "min(70vh, 680px)",
          overflowY: "auto",
          padding: "0.9rem",
          borderRadius: "22px",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, white 4%), var(--surface))",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-floating)",
          display: "grid",
          gap: "0.85rem",
          zIndex: 31,
        }}
      >
        <div style={{ display: "grid", gap: "0.18rem" }}>
          <strong style={{ fontSize: "var(--text-base)" }}>Navigate</strong>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Mobile should fold the shell into a drawer, not hide half the product.
          </span>
        </div>

        <div style={{ display: "grid", gap: "0.45rem" }}>
          {navItems.map((item) => {
            const isActive = item.id === route;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onClose();
                  onNavigate(item.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  border: isActive ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--border-subtle)",
                  background: isActive
                    ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                    : "var(--surface-2)",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "0.8rem 0.9rem",
                  borderRadius: "14px",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "10px",
                    display: "grid",
                    placeItems: "center",
                    background: isActive ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface)",
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                <span style={{ flex: 1, fontWeight: isActive ? 700 : 600 }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {activeProjects.length > 0 ? (
          <div style={{ display: "grid", gap: "0.45rem" }}>
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Projects
            </span>
            {activeProjects.map((project) => {
              const isActive = activeProjectId === project.id;
              const count = projectTaskCounts[project.id] ?? 0;
              return (
                <button
                  key={project.id}
                  onClick={() => onProjectSelect(isActive ? null : project.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.7rem",
                    width: "100%",
                    border: isActive ? `1px solid ${project.color || "var(--accent)"}` : "1px solid var(--border-subtle)",
                    background: isActive ? "color-mix(in srgb, var(--surface) 78%, white 22%)" : "var(--surface-2)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    padding: "0.75rem 0.85rem",
                    borderRadius: "14px",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{project.icon || "PR"}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {project.name}
                  </span>
                  {count > 0 ? (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-secondary)",
                        background: "var(--surface)",
                        borderRadius: "999px",
                        padding: "0.15rem 0.45rem",
                      }}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: "0.3rem",
            padding: "0.8rem 0.9rem",
            borderRadius: "16px",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Status
          </span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
            {packyWhisper?.text ?? "Packy is quiet for now."}
          </span>
        </div>
      </section>
    </>
  );
}
