import { useEffect, useRef } from "react";
import type { PropsWithChildren } from "react";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
}

export function Modal({
  children,
  open,
  title,
  onClose,
}: PropsWithChildren<ModalProps>): JSX.Element | null {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    return () => {
      triggerRef.current?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}>
      <style>{`
        @keyframes dopaflow-modal-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dopaflow-modal-panel-in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dopaflow-modal-backdrop,
          .dopaflow-modal-panel {
            animation: none !important;
          }
        }
      `}</style>
      <div
        className="dopaflow-modal-backdrop"
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "var(--overlay-backdrop, rgba(16,18,22,0.4))",
          backdropFilter: "var(--overlay-blur, blur(8px))",
          animation: "dopaflow-modal-backdrop-in 150ms ease-out",
          padding: "1rem",
          zIndex: 900,
        }}
      >
        <section
          className="dopaflow-modal-panel"
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(540px, 92vw)",
            maxWidth: "92vw",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "1.5rem",
            borderRadius: "var(--radius-lg)",
            background:
              "var(--modal-fill, color-mix(in srgb, var(--surface) 90%, transparent))",
            backdropFilter: "var(--modal-glass-blur, blur(20px))",
            border: "1px solid var(--modal-edge, var(--border))",
            boxShadow: "var(--shadow-floating)",
            animation: "dopaflow-modal-panel-in 180ms ease-out",
            position: "relative",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.12)), transparent)",
              pointerEvents: "none",
              borderRadius: "1px",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "var(--modal-inner-light, var(--surface-inner-light))",
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
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "1.25rem",
              minWidth: 0,
            }}
          >
            <strong
              style={{
                fontSize: "var(--text-lg)",
                letterSpacing: "-0.01em",
                minWidth: 0,
              }}
            >
              {title}
            </strong>
            <button
              onClick={onClose}
              aria-label="Close modal"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-2)",
                flexShrink: 0,
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                fontWeight: 800,
                width: "36px",
                height: "36px",
                borderRadius: "12px",
              }}
            >
              X
            </button>
          </header>
          {children}
        </section>
      </div>
    </div>
  );
}

export default Modal;
