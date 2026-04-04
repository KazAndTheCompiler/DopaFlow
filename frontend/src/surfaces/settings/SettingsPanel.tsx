export function SettingsPanel(): JSX.Element {
  return (
    <section
      style={{
        padding: "1.2rem 1.35rem",
        background: "linear-gradient(145deg, color-mix(in srgb, var(--surface) 90%, white 10%), var(--surface))",
        borderRadius: "22px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "1rem",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <div>
            <strong style={{ fontSize: "var(--text-xl)" }}>DopaFlow</strong>
            <span
              style={{
                marginLeft: "0.65rem",
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                fontFamily: "monospace",
              }}
            >
              v2.0.7
            </span>
          </div>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "62ch", lineHeight: 1.5 }}>
            Shape how the app feels on your machine now, while keeping the foundation clean for cloud backup and future shared-calendar workflows.
          </span>
        </div>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", padding: "0.35rem 0.65rem", borderRadius: "999px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          Local-first · FastAPI · SQLite
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
        <div style={{ padding: "0.85rem 0.9rem", borderRadius: "16px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Focus</span>
          <strong style={{ fontSize: "var(--text-lg)" }}>Theme + behavior</strong>
        </div>
        <div style={{ padding: "0.85rem 0.9rem", borderRadius: "16px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Data</span>
          <strong style={{ fontSize: "var(--text-lg)" }}>Backup + export</strong>
        </div>
        <div style={{ padding: "0.85rem 0.9rem", borderRadius: "16px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Connectivity</span>
          <strong style={{ fontSize: "var(--text-lg)" }}>Cloud + sharing</strong>
        </div>
      </div>
    </section>
  );
}

export default SettingsPanel;
