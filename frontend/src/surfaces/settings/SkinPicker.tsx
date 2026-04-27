import { useCallback, useEffect, useRef, useState } from "react";
import type { SkinMeta } from "../../hooks/useSkin";
import { saveCustomSkin } from "../../hooks/useSkin";
import { Skeleton } from "@ds/primitives/Skeleton";

const DEFAULT_SKIN = "ink-and-stone";
const CUSTOM_SKIN_KEY = "dopaflow:custom_skin";

interface SkinDefinition extends SkinMeta {
  author?: string;
  vars: Record<string, string>;
}

function normalizeCategory(value: unknown): "light" | "dark" {
  return value === "light" ? "light" : "dark";
}

async function loadExportableSkin(
  activeSkin: string,
  skins: SkinMeta[],
): Promise<SkinDefinition | null> {
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
  if (!skinMeta) {
    return null;
  }

  const skinsBase = window.location.protocol === "file:" ? "./skins" : "/skins";
  const response = await fetch(`${skinsBase}/${activeSkin}.json`);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SkinDefinition;
}

interface SkinCardProps {
  skin: SkinMeta;
  isActive: boolean;
  isPreview: boolean;
  onSelect: (id: string) => void;
}

function SkinCard({
  skin,
  isActive,
  isPreview,
  onSelect,
}: SkinCardProps): JSX.Element {
  const previewBg = skin.preview?.bg ?? "var(--surface-2)";
  const previewAccent = skin.preview?.accent ?? "var(--accent)";

  return (
    <button
      onClick={() => onSelect(skin.id)}
      title={skin.name}
      style={{
        padding: "0.8rem",
        borderRadius: "14px",
        border: isActive
          ? "2px solid var(--accent)"
          : "1px solid var(--border-subtle)",
        background: previewBg,
        cursor: "pointer",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: "0.5rem",
        textAlign: "left",
        position: "relative",
        boxShadow: isActive
          ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)"
          : "none",
        transition:
          "box-shadow 150ms ease, border-color 150ms ease, transform 100ms ease",
        transform: isPreview ? "scale(0.97)" : "scale(1)",
        outline: "none",
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(skin.id);
        }
      }}
    >
      {/* Gradient preview strip */}
      <div
        style={{
          height: 36,
          borderRadius: "8px",
          background:
            skin.id === "forest-gradient"
              ? "linear-gradient(175deg, #0b1510 0%, #1a2e1e 60%, #243d28 100%)"
              : skin.id === "ocean-gradient"
                ? "linear-gradient(170deg, #060d18 0%, #122236 65%, #1a3550 100%)"
                : skin.id === "amber-night"
                  ? "linear-gradient(165deg, #120a00 0%, #2a1a08 70%, #3a2510 100%)"
                  : skin.id === "lush-forest"
                    ? "linear-gradient(175deg, #0b1510 0%, #1a2e1e 60%, #243d28 100%)"
                    : skin.id === "nordic-glass"
                      ? "radial-gradient(ellipse at 18% 0%, #152030 0%, #090e14 70%, #07090f 100%)"
                      : skin.id === "midnight-neon"
                        ? "radial-gradient(ellipse at 85% 15%, #0d2840 0%, #091017 50%, #040a10 100%)"
                        : skin.id === "deep-ocean"
                          ? "radial-gradient(ellipse at 30% 0%, #102040 0%, #030810 70%, #020408 100%)"
                          : skin.id === "glassy-modern"
                            ? "radial-gradient(ellipse at 20% 0%, #1a3040 0%, #0f1b20 70%, #0a1318 100%)"
                            : `linear-gradient(145deg, ${previewBg} 0%, color-mix(in srgb, ${previewBg} 80%, black 20%) 100%)`,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />

      {/* Active indicator */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width="6" height="6" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5l2.5 2.5L8 3"
              stroke="var(--text-inverse)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Label row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.25rem",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: previewAccent,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {skin.name}
        </span>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase" as const,
            color: isActive ? previewAccent : "var(--text-muted)",
            opacity: isActive ? 1 : 0.5,
            flexShrink: 0,
          }}
        >
          {isActive ? "ON" : skin.category === "dark" ? "DK" : "LT"}
        </span>
      </div>

      {/* Color dots */}
      {skin.preview && (
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: skin.preview.accent,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: skin.preview.surface,
              border: "1px solid rgba(0,0,0,0.1)",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: skin.preview.bg,
              border: "1px solid rgba(0,0,0,0.1)",
              flexShrink: 0,
            }}
          />
        </div>
      )}

      {skin.accessibility && (
        <span
          style={{ fontSize: "9px", color: "var(--text-muted)", opacity: 0.7 }}
        >
          AC {skin.accessibility}
        </span>
      )}
    </button>
  );
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
  const [importError, setImportError] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const light = skins.filter((s) => s.category === "light");
  const dark = skins.filter((s) => s.category === "dark");

  // Flash confirmation when a skin is applied
  const handleSelect = useCallback(
    (id: string) => {
      onPick(id);
      setAppliedId(id);
      if (appliedTimerRef.current) {
        clearTimeout(appliedTimerRef.current);
      }
      appliedTimerRef.current = setTimeout(() => setAppliedId(null), 1200);
    },
    [onPick],
  );

  useEffect(() => {
    return () => {
      if (appliedTimerRef.current) {
        clearTimeout(appliedTimerRef.current);
      }
    };
  }, []);

  const handleReset = useCallback(() => {
    onPick(DEFAULT_SKIN);
    setAppliedId(DEFAULT_SKIN);
    if (appliedTimerRef.current) {
      clearTimeout(appliedTimerRef.current);
    }
    appliedTimerRef.current = setTimeout(() => setAppliedId(null), 1200);
  }, [onPick]);

  const handleExport = useCallback(() => {
    void loadExportableSkin(current, skins).then((skinToExport) => {
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
  }, [current, skins]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(
            event.target?.result as string,
          ) as Partial<SkinDefinition>;
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
          if (imported.preview) {
            normalized.preview = imported.preview;
          }
          if (typeof imported.accessibility === "string") {
            normalized.accessibility = imported.accessibility;
          }
          if (typeof imported.author === "string") {
            normalized.author = imported.author;
          }
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
    },
    [onPick],
  );

  const group = (label: string, items: SkinMeta[]) => (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {items.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            isActive={skin.id === current}
            isPreview={skin.id === appliedId}
            onSelect={handleSelect}
          />
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: "0.5rem",
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: "0.8rem",
                  borderRadius: "14px",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--surface-2)",
                  display: "grid",
                  gridTemplateRows: "auto auto auto",
                  gap: "0.5rem",
                }}
              >
                <Skeleton height="36px" borderRadius="8px" />
                <Skeleton height="12px" />
                <Skeleton height="10px" width="60%" />
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
        <strong style={{ fontSize: "var(--text-base)" }}>Theme</strong>
        <span
          style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}
        >
          No themes available. The skin manifest could not be loaded.
        </span>
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
        backdropFilter: "var(--surface-glass-blur, blur(14px))",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-soft)",
        position: "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: "8%",
          right: "8%",
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)",
          pointerEvents: "none",
          borderRadius: "1px",
        }}
      />

      {/* Header */}
      <div style={{ display: "grid", gap: "0.2rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Theme</strong>
        <span
          style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}
        >
          Click to apply instantly. 24 skins · 3 gradient skins marked DK.
        </span>
      </div>

      {/* Active skin strip */}
      {(() => {
        const activeMeta = skins.find((s) => s.id === current);
        if (!activeMeta) {
          return null;
        }
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.65rem 0.9rem",
              borderRadius: "12px",
              background: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                background: activeMeta.preview?.bg ?? "var(--surface)",
                border: "1px solid var(--border-subtle)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  display: "block",
                }}
              >
                {activeMeta.name}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                }}
              >
                {current === appliedId ? "Applied!" : "Currently active"}
              </span>
            </div>
            {current !== DEFAULT_SKIN && (
              <button
                onClick={handleReset}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 500,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Reset
              </button>
            )}
          </div>
        );
      })()}

      {light.length > 0 && group("Light", light)}
      {dark.length > 0 && group("Dark", dark)}

      {/* Import / Export */}
      <div
        style={{
          display: "flex",
          gap: "0.6rem",
          flexWrap: "wrap",
          paddingTop: "0.35rem",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <button
          onClick={handleExport}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
        <div
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "8px",
            background:
              "color-mix(in srgb, var(--state-overdue) 12%, transparent)",
            border: "1px solid var(--state-overdue)",
            color: "var(--state-overdue)",
            fontSize: "var(--text-xs)",
          }}
        >
          {importError}
        </div>
      )}
    </section>
  );
}

export default SkinPicker;
