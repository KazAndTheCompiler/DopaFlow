import { useCallback, useRef, useState } from "react";
import type { SkinMeta } from "../../hooks/useSkin";
import { saveCustomSkin } from "../../hooks/useSkin";
import { Skeleton } from "@ds/primitives/Skeleton";

const DEFAULT_SKIN = "ink-and-stone";
const CUSTOM_SKIN_KEY = "zoestm-custom-skin";

interface SkinDefinition extends SkinMeta {
  author?: string;
  vars: Record<string, string>;
}

function normalizeCategory(value: unknown): "light" | "dark" {
  return value === "light" ? "light" : "dark";
}

async function loadExportableSkin(activeSkin: string, skins: SkinMeta[]): Promise<SkinDefinition | null> {
  try {
    const rawCustomSkin = window.localStorage.getItem(CUSTOM_SKIN_KEY);
    if (rawCustomSkin) {
      const customSkin = JSON.parse(rawCustomSkin) as SkinDefinition;
      if (customSkin?.id === activeSkin && customSkin.vars) {
        return customSkin;
      }
    }
  } catch {
    // Ignore local custom skin parse failures and fall back to the shipped skin fetch.
  }

  const skinMeta = skins.find((skin) => skin.id === activeSkin);
  if (!skinMeta) return null;

  const skinsBase = window.location.protocol === "file:" ? "./skins" : "/skins";
  const response = await fetch(`${skinsBase}/${activeSkin}.json`);
  if (!response.ok) return null;
  return (await response.json()) as SkinDefinition;
}

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
  const [previewSkin, setPreviewSkin] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const light = skins.filter((s) => s.category === "light");
  const dark = skins.filter((s) => s.category === "dark");

  const activeSkin = previewSkin ?? current;
  const activeSkinMeta = skins.find((s) => s.id === activeSkin);
  const isPreviewing = previewSkin !== null;

  const handleReset = useCallback(() => {
    onPick(DEFAULT_SKIN);
    setPreviewSkin(null);
  }, [onPick]);

  const handleExport = useCallback(() => {
    void loadExportableSkin(activeSkin, skins).then((skinToExport) => {
      if (!skinToExport) {
        setImportError("Could not export this skin.");
        return;
      }
      const dataStr = JSON.stringify(skinToExport, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${skinToExport.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setImportError(null);
    });
  }, [activeSkin, skins]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as Partial<SkinDefinition>;
        if (!imported.id || !imported.name || !imported.vars) {
          setImportError("Invalid skin format: missing required fields");
          return;
        }
        const normalized: SkinDefinition = {
          id: imported.id,
          name: imported.name,
          category: normalizeCategory(imported.category),
          vars: imported.vars,
        };
        if (imported.preview) normalized.preview = imported.preview;
        if (typeof imported.accessibility === "string") normalized.accessibility = imported.accessibility;
        if (typeof imported.author === "string") normalized.author = imported.author;
        saveCustomSkin(normalized);
        setImportError(null);
        onPick(normalized.id);
      } catch {
        setImportError("Failed to parse skin file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onPick]);

  const handlePreview = useCallback((id: string) => {
    setPreviewSkin(id);
  }, []);

  const handleApply = useCallback(() => {
    if (previewSkin) {
      onPick(previewSkin);
      setPreviewSkin(null);
    }
  }, [previewSkin, onPick]);

  const handleCancelPreview = useCallback(() => {
    setPreviewSkin(null);
  }, []);

  const group = (label: string, items: SkinMeta[]): JSX.Element => (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem" }}>
        {items.map((skin) => (
          <button
            key={skin.id}
            onClick={() => handlePreview(skin.id)}
            onDoubleClick={() => onPick(skin.id)}
            title="Single click to preview, double click to apply"
            style={{
              padding: "0.75rem",
              borderRadius: "12px",
              border: skin.id === activeSkin ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
              background: skin.preview?.bg ?? "var(--surface-2)",
              cursor: "pointer",
              display: "grid",
              gap: "0.4rem",
              textAlign: "left",
              boxShadow: skin.id === activeSkin ? "0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)" : "none",
              transition: "box-shadow 150ms ease, border-color 150ms ease",
              position: "relative",
            }}
          >
            {skin.id === activeSkin && (
              <div style={{
                position: "absolute",
                top: "6px",
                right: "6px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--accent)",
              }} />
            )}
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

  if (skins.length === 0) {
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
            No themes available. The skin manifest could not be loaded.
          </span>
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
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "var(--surface-glass-blur, blur(14px))",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-soft)",
          position: "relative",
        }}
      >
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Theme</strong>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Pick the visual mood of the app. Single-click to preview, double-click or use Apply to apply.
        </span>
      </div>

      {activeSkinMeta && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: "1rem",
            alignItems: "center",
            padding: "0.9rem 1rem",
            borderRadius: "14px",
            background: "var(--surface-2)",
            border: isPreviewing ? "2px dashed var(--accent)" : "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "8px", background: activeSkinMeta.preview?.bg ?? "var(--surface)" }} />
            <div style={{ width: 28, height: 28, borderRadius: "8px", background: activeSkinMeta.preview?.surface ?? "var(--surface-2)", border: "1px solid var(--border-subtle)" }} />
            <div style={{ width: 28, height: 28, borderRadius: "8px", background: activeSkinMeta.preview?.accent ?? "var(--accent)" }} />
          </div>
          <div style={{ display: "grid", gap: "0.15rem" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
              {activeSkinMeta.name}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              {isPreviewing ? "Previewing (not applied yet)" : "Currently active"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {isPreviewing ? (
              <>
                <button
                  onClick={handleApply}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--accent)",
                    color: "var(--text-inverse)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Apply
                </button>
                <button
                  onClick={handleCancelPreview}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleReset}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Reset to default
              </button>
            )}
          </div>
        </div>
      )}

      {light.length > 0 && group("Light", light)}
      {dark.length > 0 && group("Dark", dark)}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--border-subtle)" }}>
        <button
          onClick={handleExport}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: "none" }}
        />
      </div>

      {importError && (
        <div style={{
          padding: "0.5rem 0.75rem",
          borderRadius: "8px",
          background: "color-mix(in srgb, var(--error) 15%, transparent)",
          border: "1px solid var(--error)",
          color: "var(--error)",
          fontSize: "var(--text-xs)",
        }}>
          {importError}
        </div>
      )}
    </section>
  );
}

export default SkinPicker;
