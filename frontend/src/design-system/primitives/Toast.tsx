import { useEffect, useState } from "react";
import { show, type ToastType } from "../../app/toastService";

interface ToastEntry {
  id: number;
  message: string;
  type: ToastType;
}

export function showToast(message: string, type: ToastType = "info"): void {
  show(message, type);
}

const TYPE_COLORS: Record<ToastType, string> = {
  success: "var(--state-ok)",
  error: "var(--state-overdue)",
  warn: "var(--state-warn)",
  info: "var(--accent)",
};

const TYPE_BG: Record<ToastType, string> = {
  success: "var(--state-ok)18",
  error: "var(--state-overdue)18",
  warn: "var(--state-warn)18",
  info: "var(--accent)18",
};

const TYPE_ICON: Record<ToastType, string> = {
  success: "OK",
  error: "ER",
  warn: "WR",
  info: "IN",
};

function ToastItem({
  entry,
  onRemove,
}: {
  entry: ToastEntry;
  onRemove: (id: number) => void;
}): JSX.Element {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(entry.id), 200);
    }, 3500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.65rem 0.9rem",
        borderRadius: "12px",
        background: "color-mix(in srgb, var(--surface) 88%, transparent)",
        backdropFilter: "var(--surface-glass-blur, blur(14px))",
        border: `1px solid ${TYPE_COLORS[entry.type]}44`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        minWidth: "240px",
        maxWidth: "360px",
        transform: visible ? "translateX(0)" : "translateX(24px)",
        opacity: visible ? 1 : 0,
        transition: "transform 200ms ease, opacity 200ms ease",
        cursor: "pointer",
        position: "relative",
      }}
      onClick={() => onRemove(entry.id)}
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
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--surface-inner-light)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "35%",
          background: "var(--surface-inner-highlight)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--surface-specular)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />
      <span
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: TYPE_BG[entry.type],
          color: TYPE_COLORS[entry.type],
          display: "grid",
          placeItems: "center",
          fontSize: "0.58rem",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {TYPE_ICON[entry.type]}
      </span>
      <span
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text)",
          lineHeight: 1.4,
        }}
      >
        {entry.message}
      </span>
    </div>
  );
}

export function ToastContainer(): JSX.Element {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<ToastEntry>).detail;
      setToasts((prev) => [...prev.slice(-4), detail]);
    };
    window.addEventListener("dopaflow:toast", handler);
    return () => window.removeEventListener("dopaflow:toast", handler);
  }, []);

  const remove = (id: number): void =>
    setToasts((prev) => prev.filter((t) => t.id !== id));
  const liveMode =
    toasts[toasts.length - 1]?.type === "error" ? "assertive" : "polite";

  if (!toasts.length) {
    return <></>;
  }

  return (
    <div
      role="status"
      aria-live={liveMode}
      style={{
        position: "fixed",
        bottom: "calc(var(--statusbar-height) + 1rem)",
        right: "1.25rem",
        display: "grid",
        gap: "0.5rem",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem entry={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
