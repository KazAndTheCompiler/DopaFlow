import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface SurfaceErrorBoundaryProps {
  children: ReactNode;
  route: string;
}

interface SurfaceErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | undefined;
}

export function localDateISO(offsetDays = 0): string {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
}

export function getCommandReply(result: { reply?: string | null }): string {
  const reply = result.reply;
  return typeof reply === "string" ? reply.trim() : "";
}

export class SurfaceErrorBoundary extends Component<SurfaceErrorBoundaryProps, SurfaceErrorBoundaryState> {
  override state: SurfaceErrorBoundaryState = { hasError: false, errorMessage: undefined };

  override componentDidUpdate(prevProps: SurfaceErrorBoundaryProps): void {
    if (prevProps.route !== this.props.route && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: undefined });
    }
  }

  static getDerivedStateFromError(error: Error): SurfaceErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[DopaFlow] Surface crashed on route "${this.props.route}"`, error, errorInfo);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: "1rem 1.1rem",
            borderRadius: "16px",
            border: "1px solid color-mix(in srgb, var(--state-overdue) 30%, var(--border-subtle))",
            background: "color-mix(in srgb, var(--state-overdue) 10%, var(--surface))",
            color: "var(--text)",
            display: "grid",
            gap: "0.35rem",
          }}
        >
          <strong>Surface failed to render.</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Route: {this.props.route}
          </span>
          {this.state.errorMessage ? (
            <code style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflowWrap: "anywhere" }}>
              {this.state.errorMessage}
            </code>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
