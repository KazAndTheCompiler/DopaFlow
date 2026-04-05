import type { SkinMeta } from "../../hooks/useSkin";
import { Skeleton } from "@ds/primitives/Skeleton";

export function SkinPicker({
  current,
  skins,
  loading = false,
  onPick,
}: {
  current: string;
  skins: SkinMeta[];
  loading?: boolean;
  onPick: (id: string) => void;
}): JSX.Element {
  const light = skins.filter((s) => s.category === "light");
  const dark = skins.filter((s) => s.category === "dark");

  const group = (label: string, items: SkinMeta[]): JSX.Element => (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem" }}>
        {items.map((skin) => (
          <button
            key={skin.id}
            onClick={() => onPick(skin.id)}
            style={{
              padding: "0.75rem",
              borderRadius: "12px",
              border: skin.id === current ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
              background: skin.preview?.bg ?? "var(--surface-2)",
              cursor: "pointer",
              display: "grid",
              gap: "0.4rem",
              textAlign: "left",
              boxShadow: skin.id === current ? "0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)" : "none",
              transition: "box-shadow 150ms ease, border-color 150ms ease",
            }}
          >
            {skin.preview && (
              <div style={{ display: "flex", gap: "4px" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: skin.preview.accent }} />
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: skin.preview.surface, border: "1px solid rgba(0,0,0,0.08)" }} />
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: skin.preview.bg, border: "1px solid rgba(0,0,0,0.08)" }} />
              </div>
            )}
            <span style={{
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: skin.preview?.accent ?? "var(--text)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {skin.name}
            </span>
            {skin.accessibility && (
              <span style={{ fontSize: "10px", color: skin.preview?.accent ?? "var(--text-secondary)", opacity: 0.7 }}>
                AC {skin.accessibility}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <section
        style={{
          display: "grid",
          gap: "1.25rem",
          padding: "1.1rem 1.25rem",
          borderRadius: "20px",
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div style={{ display: "grid", gap: "0.25rem" }}>
          <Skeleton width="72px" height="20px" borderRadius="8px" />
          <Skeleton width="90%" height="14px" />
          <Skeleton width="76%" height="14px" />
        </div>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <Skeleton width="64px" height="12px" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem" }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                style={{
                  padding: "0.75rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--surface-2)",
                  display: "grid",
                  gap: "0.4rem",
                }}
              >
                <div style={{ display: "flex", gap: "4px" }}>
                  <Skeleton width="14px" height="14px" borderRadius="50%" />
                  <Skeleton width="14px" height="14px" borderRadius="50%" />
                  <Skeleton width="14px" height="14px" borderRadius="50%" />
                </div>
                <Skeleton width="78%" height="14px" />
                <Skeleton width="34%" height="10px" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        display: "grid",
        gap: "1.25rem",
        padding: "1.1rem 1.25rem",
        borderRadius: "20px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Theme</strong>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Pick the visual mood of the app. Theme choice affects the entire shell, so it should feel deliberate rather than cosmetic.
        </span>
      </div>
      {light.length > 0 && group("Light", light)}
      {dark.length > 0 && group("Dark", dark)}
    </section>
  );
}

export default SkinPicker;
