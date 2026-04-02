import type { CalendarEvent } from "../../../../shared/types";
import EmptyState from "../../design-system/primitives/EmptyState";
import { CATEGORY_COLORS } from "./WeekView";

interface MonthViewProps {
  events: CalendarEvent[];
  month?: Date;
  sourceColors?: Record<string, string>;
  sourceLabels?: Record<string, string>;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function eventColor(event: CalendarEvent): string {
  return CATEGORY_COLORS[event.category ?? ""] ?? "var(--accent)";
}

function eventSourceKey(event: CalendarEvent): string {
  if (event.source_type?.startsWith("peer:")) {
    return event.source_type.slice("peer:".length);
  }
  return "local";
}

function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function MonthView({ events, month, sourceColors = {}, sourceLabels = {} }: MonthViewProps): JSX.Element {
  const anchor = month ?? new Date();
  const days = monthGrid(anchor);
  const today = new Date();
  const monthHasEvents = events.some((event) => new Date(event.start_at).getMonth() === anchor.getMonth());

  return (
    <section
      style={{
        padding: "1rem",
        background: "var(--surface-2)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.65rem",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.45rem" }}>
        {DAYS.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {!monthHasEvents && (
        <div style={{ padding: "0.65rem 0.25rem 0.2rem" }}>
          <EmptyState
            icon="CL"
            title="Nothing scheduled this month"
            subtitle="Local and mirrored calendar events will appear here once they land inside this month."
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.45rem" }}>
        {days.map((day) => {
          const dayEvents = events.filter((event) => sameDay(new Date(event.start_at), day));
          const isToday = sameDay(day, today);
          const inMonth = day.getMonth() === anchor.getMonth();

          return (
            <div
              key={day.toISOString()}
              style={{
                minHeight: "112px",
                padding: "0.55rem",
                borderRadius: "14px",
                border: isToday ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                background: isToday ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--surface)",
                opacity: inMonth ? 1 : 0.4,
                display: "grid",
                alignContent: "start",
                gap: "0.35rem",
              }}
            >
              <strong
                style={{
                  fontSize: "var(--text-sm)",
                  color: inMonth ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {day.getDate()}
              </strong>

              {dayEvents.slice(0, 3).map((event) => {
                const sourceKey = eventSourceKey(event);
                const sourceColor = sourceColors[sourceKey] ?? eventColor(event);
                const sourceLabel = sourceLabels[sourceKey] ?? "Local";
                return (
                <div
                  key={event.id}
                  title={`${event.title} · ${sourceLabel}${event.provider_readonly ? " · read-only" : ""}`}
                  style={{
                    padding: "0.2rem 0.35rem",
                    borderRadius: "6px",
                    background: `linear-gradient(165deg, color-mix(in srgb, ${sourceColor} 24%, var(--surface)), color-mix(in srgb, ${sourceColor} 14%, var(--surface)))`,
                    border: `1px solid color-mix(in srgb, ${sourceColor} 40%, var(--border-subtle))`,
                    color: "var(--text-primary)",
                    fontSize: "var(--text-xs)",
                    overflow: "hidden",
                    display: "grid",
                    gap: "0.15rem",
                    opacity: event.provider_readonly ? 0.86 : 1,
                  }}
                >
                  <span style={{ fontSize: "9px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sourceLabel}
                  </span>
                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {event.title}
                  </span>
                </div>
                );
              })}

              {dayEvents.length > 3 ? (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  + {dayEvents.length - 3} more
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default MonthView;
