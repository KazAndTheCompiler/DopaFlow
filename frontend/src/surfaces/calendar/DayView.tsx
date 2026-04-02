import type { CalendarEvent } from "../../../../shared/types";
import EmptyState from "../../design-system/primitives/EmptyState";
import { CATEGORY_COLORS } from "./WeekView";

interface DayViewProps {
  events: CalendarEvent[];
  date?: Date;
  onSlotClick?: (hour: number) => void;
  sourceColors?: Record<string, string>;
  sourceLabels?: Record<string, string>;
}

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

const HOUR_ROW_REM = 2.5;

function topOffsetRem(event: CalendarEvent): number {
  const start = new Date(event.start_at);
  return start.getHours() * HOUR_ROW_REM + (start.getMinutes() / 60) * HOUR_ROW_REM + 0.2;
}

function heightRem(event: CalendarEvent): number {
  const start = new Date(event.start_at).getTime();
  const end = new Date(event.end_at).getTime();
  const minutes = Math.max(30, Math.round((end - start) / 60_000));
  return Math.max(1, (minutes / 60) * HOUR_ROW_REM - 0.4);
}

export function DayView({ events, date, onSlotClick, sourceColors = {}, sourceLabels = {} }: DayViewProps): JSX.Element {
  const targetDate = date ?? new Date();
  const dayEvents = events.filter((event) => sameDay(new Date(event.start_at), targetDate));
  const allDayEvents = dayEvents.filter((event) => event.all_day);
  const timedEvents = dayEvents.filter((event) => !event.all_day);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const now = new Date();
  const currentHour = sameDay(targetDate, now) ? now.getHours() : -1;
  const hasEvents = dayEvents.length > 0;

  return (
    <section
      style={{
        padding: "1rem",
        background: "var(--surface)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        maxHeight: "600px",
        overflowY: "auto",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <div style={{ display: "grid", gap: "0.45rem" }}>
        <strong>All day</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
          {allDayEvents.length === 0 ? (
            <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>No all-day events.</span>
          ) : (
            allDayEvents.map((event) => (
              (() => {
                const sourceKey = eventSourceKey(event);
                return (
                  <span
                    key={event.id}
                    title={sourceLabels[sourceKey] ?? "Local"}
                    style={{
                      padding: "0.35rem 0.6rem",
                      borderRadius: "999px",
                      background: sourceColors[sourceKey] ?? eventColor(event),
                      color: "var(--text-inverted)",
                      fontSize: "var(--text-sm)",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      opacity: event.provider_readonly ? 0.88 : 1,
                    }}
                  >
                    {event.title}
                  </span>
                );
              })()
            ))
          )}
        </div>
      </div>

      {!hasEvents && (
        <EmptyState
          icon="CL"
          title="Open day"
          subtitle="No events are scheduled here yet. Click an hour slot to block time or pull in a shared calendar feed."
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateRows: `repeat(24, ${HOUR_ROW_REM}rem)` }}>
          {hours.map((hour) => (
            <div
              key={hour}
              style={{
                height: `${HOUR_ROW_REM}rem`,
                display: "flex",
                alignItems: "start",
                justifyContent: "flex-end",
                paddingRight: "0.4rem",
                fontSize: "0.7rem",
                color: hour === currentHour ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: hour === currentHour ? 700 : 400,
              }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div style={{ position: "relative", display: "grid", gridTemplateRows: `repeat(24, ${HOUR_ROW_REM}rem)` }}>
          {hours.map((hour) => (
            <div
              key={hour}
              onClick={() => onSlotClick?.(hour)}
              style={{
                borderTop: "none",
                borderBottom: hour === currentHour
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border-subtle)",
                background: hour === currentHour ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "transparent",
                cursor: onSlotClick ? "pointer" : "default",
              }}
              title={onSlotClick ? `Block ${String(hour).padStart(2, "0")}:00` : undefined}
            />
          ))}

          {timedEvents.map((event) => {
            const start = new Date(event.start_at);
            const sourceKey = eventSourceKey(event);
            const sourceColor = sourceColors[sourceKey] ?? eventColor(event);
            const sourceLabel = sourceLabels[sourceKey] ?? "Local";
            return (
              <div
                key={event.id}
                title={`${event.title} · ${sourceLabel}`}
                style={{
                  position: "absolute",
                  left: "0.45rem",
                  right: "0.45rem",
                  top: `${topOffsetRem(event)}rem`,
                  minHeight: "1rem",
                  height: `${heightRem(event)}rem`,
                  padding: "0.45rem 0.6rem",
                  borderRadius: "12px",
                  background: `linear-gradient(165deg, color-mix(in srgb, ${sourceColor} 24%, var(--surface)), color-mix(in srgb, ${sourceColor} 14%, var(--surface)))`,
                  border: `1px solid color-mix(in srgb, ${sourceColor} 40%, var(--border-subtle))`,
                  opacity: event.provider_readonly ? 0.84 : 1,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  pointerEvents: "none",
                  display: "grid",
                  alignContent: "start",
                  gap: "0.2rem",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", minWidth: 0 }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: sourceColor, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sourceLabel}
                  </span>
                </div>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {event.title}
                </span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {String(start.getHours()).padStart(2, "0")}:{String(start.getMinutes()).padStart(2, "0")}
                  {" - "}
                  {new Date(event.end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {event.provider_readonly ? " · read-only" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default DayView;
