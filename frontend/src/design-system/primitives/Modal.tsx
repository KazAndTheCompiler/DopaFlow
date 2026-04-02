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
          background: "rgba(16, 18, 22, 0.4)",
          animation: "dopaflow-modal-backdrop-in 150ms ease-out",
          padding: "1rem",
          zIndex: 900,
        }}
      >
      <section
        className="dopaflow-modal-panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          minWidth: "min(540px, 92vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.5rem",
          borderRadius: "var(--radius-lg)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-floating)",
          animation: "dopaflow-modal-panel-in 180ms ease-out",
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <strong style={{ fontSize: "var(--text-lg)", letterSpacing: "-0.01em" }}>{title}</strong>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
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
