import { useEffect, useRef, useState } from "react";

import type { Project } from "@shared/types";
import { sidebarRoutes, type AppRoute } from "../appRoutes";
import Button from "../design-system/primitives/Button";
import Input from "../design-system/primitives/Input";
import VoiceButton from "../design-system/primitives/VoiceButton";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

interface Suggestion {
  label: string;
  hint?: string;
  icon?: string;
  action: () => void;
}

interface CommandPaletteProps {
  onExecute: (text: string) => Promise<void>;
  projects?: Project[];
  onProjectSelect?: (id: string | null) => void;
  onNavigate?: (route: AppRoute) => void;
}

export default function CommandPalette({ onExecute, projects = [], onProjectSelect, onNavigate }: CommandPaletteProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { listening, transcript, interim, error: sttError, start, stop, supported, reset } = useSpeechRecognition();

  const q = input.toLowerCase().trim();
  const suggestions: Suggestion[] = [];

  // Project filter suggestions
  if (onProjectSelect) {
    const matchedProjects = projects
      .filter((p) => !p.archived && (!q || p.name.toLowerCase().includes(q) || q.startsWith("project")))
      .slice(0, 4);
    matchedProjects.forEach((p) => {
      suggestions.push({
        label: `Filter: ${p.name}`,
        hint: `Show only ${p.name} tasks`,
        icon: p.icon || "PR",
        action: () => { onProjectSelect(p.id); setOpen(false); setInput(""); },
      });
    });
  }

  // Nav suggestions
  sidebarRoutes.filter((route) => !q || route.label.toLowerCase().includes(q) || route.id.includes(q)).slice(0, 5).forEach((route) => {
    suggestions.push({
      label: `Go to ${route.label}`,
      icon: route.icon,
      action: () => { onNavigate?.(route.id); setOpen(false); setInput(""); },
    });
  });

  // Clear project filter
  if (onProjectSelect && (!q || "clear".includes(q) || "all".includes(q))) {
    suggestions.unshift({ label: "Clear project filter", icon: "CL", action: () => { onProjectSelect(null); setOpen(false); setInput(""); } });
  }

  // When a final transcript comes in, fill input and let user confirm
  useEffect(() => {
    if (transcript && open) {
      setInput(transcript);
      reset();
    }
  }, [open, reset, transcript]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [input, open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);
  const handleExecute = async (): Promise<void> => {
    if (suggestions.length > 0 && !input.startsWith("/")) {
      suggestions[Math.min(selectedIdx, suggestions.length - 1)]?.action();
      return;
    }
    if (input.trim()) {
      await onExecute(input);
      setInput("");
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { void handleExecute(); }
    else if (e.key === "Escape") { setOpen(false); }
  };
  if (!open) return null;
  return (
    <div
      data-testid="command-palette-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(8,10,14,0.46)",
        display: "flex",
        alignItems: "flex-start",
        paddingTop: "5rem",
        zIndex: 1000,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        data-testid="command-palette"
        style={{
          width: "90%",
          maxWidth: "640px",
          margin: "0 auto",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%), var(--surface))",
          borderRadius: "24px",
          padding: "1rem",
          boxShadow: "0 18px 48px rgba(0,0,0,0.24)",
          border: "1px solid var(--border-subtle)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "0.15rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
                Command palette
              </span>
              <strong style={{ fontSize: "clamp(1.1rem, 1.6vw, 1.35rem)", letterSpacing: "-0.02em" }}>
                Move fast without leaving the keyboard
              </strong>
            </div>
            <span
              style={{
                padding: "0.35rem 0.62rem",
                borderRadius: "999px",
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                fontWeight: 700,
              }}
            >
              Ctrl/Cmd + K
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          <Input
            ref={inputRef}
            type="text"
            placeholder={listening ? "Listening…" : "Type a command... (add task, focus, list habits)"}
            value={listening ? interim || input : input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, fontSize: "1rem" }}
          />
          <VoiceButton
            listening={listening}
            supported={supported}
            onToggle={() => (listening ? stop() : start())}
            title="Speak your command"
          />
        </div>
        </div>
        {sttError ? (
          <div style={{ marginTop: "0.65rem", color: "var(--state-error)", fontSize: "var(--text-sm)" }}>
            {sttError}
          </div>
        ) : null}
        {suggestions.length > 0 && (
          <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.35rem", maxHeight: "280px", overflowY: "auto" }}>
            {suggestions.slice(0, 8).map((s, i) => (
              <button
                key={i}
                onClick={s.action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  padding: "0.7rem 0.8rem",
                  borderRadius: "14px",
                  border: "none",
                  background: i === selectedIdx ? "linear-gradient(145deg, color-mix(in srgb, var(--surface) 78%, white 22%), var(--surface))" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  textAlign: "left",
                  transition: "background 100ms ease, transform 100ms ease",
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "12px",
                    textAlign: "center",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: i === selectedIdx ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface-2)",
                    color: i === selectedIdx ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                >
                  {s.icon}
                </span>
                <span style={{ flex: 1, display: "grid", gap: "0.1rem" }}>
                  <span style={{ fontWeight: 700 }}>{s.label}</span>
                  {s.hint && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{s.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.6rem" }}>
          <Button onClick={() => void handleExecute()} style={{ flex: 1 }}>
            Run
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)} style={{ flex: 1 }}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
