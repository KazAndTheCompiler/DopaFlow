import React from "react";
import type { ErrorInfo, PropsWithChildren, ReactNode } from "react";

interface SurfaceErrorBoundaryState {
  error: Error | null;
}

export class SurfaceErrorBoundary extends React.Component<
  PropsWithChildren,
  SurfaceErrorBoundaryState
> {
  override state: SurfaceErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SurfaceErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[DopaFlow] Surface crashed", error, errorInfo);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: "1.25rem",
            borderRadius: "20px",
            border:
              "1px solid color-mix(in srgb, var(--state-overdue) 24%, var(--border-subtle))",
            background:
              "color-mix(in srgb, var(--state-overdue) 10%, var(--surface))",
            display: "grid",
            gap: "0.85rem",
          }}
        >
          <strong style={{ fontSize: "1rem", lineHeight: 1.4 }}>
            Something went wrong in this panel
          </strong>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              justifySelf: "start",
              padding: "0.7rem 1rem",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--surface-elevated, var(--surface-2))",
              color: "var(--text)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Reload panel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SurfaceErrorBoundary;
