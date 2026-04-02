import { useRef, useState } from "react";
import type { CalendarEvent, FocusSession } from "../../../../shared/types";
import { CATEGORY_COLORS } from "../calendar/WeekView";

export interface TimeBlocksProps {
  sessions: FocusSession[];
  events: CalendarEvent[];
  onRescheduleEvent?: (id: string, newStartAt: string) => void;
}

type BlockItem = {
  id: string;
  title: string;
  top: number;
  height: number;
  color: string;
  lane: 0 | 1;
  kind: "session" | "event";
};

const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

function buildBlocks(sessions: FocusSession[], events: CalendarEvent[]): BlockItem[] {
  const items: Array<BlockItem & { startMinutes: number; endMinutes: number }> = [];

  sessions.forEach((session) => {
    const start = new Date(session.started_at);
    const startMinutes = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
    if (startMinutes < 0 || startMinutes > TOTAL_MINUTES) return;
    const dur = Math.max(session.duration_minutes, 24);
    items.push({ id: session.id, title: `Focus · ${session.duration_minutes}m`, top: (startMinutes / TOTAL_MINUTES) * 100, height: Math.max((dur / TOTAL_MINUTES) * 100, 2.5), color: "var(--accent)", lane: 0, kind: "session", startMinutes, endMinutes: startMinutes + dur });
  });

  events.forEach((event) => {
    const start = new Date(event.start_at);
    const startMinutes = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
    if (startMinutes < 0 || startMinutes > TOTAL_MINUTES) return;
    const dur = Math.max(30, Math.round((new Date(event.end_at).getTime() - start.getTime()) / 60_000));
    items.push({ id: event.id, title: event.title, top: (startMinutes / TOTAL_MINUTES) * 100, height: Math.max((dur / TOTAL_MINUTES) * 100, 2.5), color: CATEGORY_COLORS[event.category ?? ""] ?? "var(--accent)", lane: 0, kind: "event", startMinutes, endMinutes: startMinutes + dur });
  });

  items.sort((a, b) => a.startMinutes - b.startMinutes);
  const laneEnds = [0, 0];
  return items.map((item) => {
    const lane: 0 | 1 = item.startMinutes < laneEnds[0] ? 1 : 0;
    laneEnds[lane] = Math.max(laneEnds[lane], item.endMinutes);
    return { id: item.id, title: item.title, top: item.top, height: item.height, color: item.color, lane, kind: item.kind };
  });
}

function minutesToIso(absoluteMinutes: number): string {
  const today = new Date();
  today.setHours(Math.floor(absoluteMinutes / 60), absoluteMinutes % 60, 0, 0);
  return today.toISOString();
}

export function TimeBlocks({ sessions, events, onRescheduleEvent }: TimeBlocksProps): JSX.Element {
  const blocks = buildBlocks(sessions, events);
  const labels = Array.from({ length: 9 }, (_, i) => START_HOUR + i * 2);
  const gridRef = useRef<HTMLDivElement>(null);

  // Drag state kept in refs to avoid re-renders during move
  const dragRef = useRef<{ id: string; kind: "session" | "event"; offsetPct: number } | null>(null);
  const [dragTopPct, setDragTopPct] = useState<{ id: string; pct: number } | null>(null);

  const getRelativePct = (clientY: number): number => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
  };

  const onBlockMouseDown = (e: React.MouseEvent, block: BlockItem): void => {
    if (block.kind === "session" || !onRescheduleEvent) return; // only events are reschedulable
    e.preventDefault();
    const pct = getRelativePct(e.clientY);
    dragRef.current = { id: block.id, kind: block.kind, offsetPct: pct - block.top };
    setDragTopPct({ id: block.id, pct: block.top });
  };

  const onGridMouseMove = (e: React.MouseEvent): void => {
    if (!dragRef.current) return;
    const pct = getRelativePct(e.clientY) - dragRef.current.offsetPct;
    setDragTopPct({ id: dragRef.current.id, pct: Math.max(0, Math.min(97, pct)) });
  };

  const onGridMouseUp = (): void => {
    if (!dragRef.current || !dragTopPct || !onRescheduleEvent) { dragRef.current = null; setDragTopPct(null); return; }
    const newMinutes = Math.round((dragTopPct.pct / 100) * TOTAL_MINUTES / 15) * 15 + START_HOUR * 60;
    onRescheduleEvent(dragRef.current.id, minutesToIso(newMinutes));
    dragRef.current = null;
    setDragTopPct(null);
  };

  return (
    <section style={{ padding: "1.1rem 1.15rem", borderRadius: "20px", background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
      <strong style={{ display: "block", fontSize: "var(--text-base)", marginBottom: "0.85rem" }}>Today's blocks</strong>
      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: "0.75rem" }}>
        <div style={{ position: "relative", height: "480px" }}>
          {labels.map((hour) => (
            <span key={hour} style={{ position: "absolute", top: `${((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%`, transform: "translateY(-50%)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {String(hour).padStart(2, "0")}
            </span>
          ))}
        </div>
        <div
          ref={gridRef}
          onMouseMove={onGridMouseMove}
          onMouseUp={onGridMouseUp}
          onMouseLeave={onGridMouseUp}
          style={{ position: "relative", height: "480px", borderRadius: "14px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)", overflow: "hidden", userSelect: "none" }}
        >
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${(i / (END_HOUR - START_HOUR)) * 100}%`, borderTop: "1px solid color-mix(in srgb, var(--border-subtle) 60%, transparent)" }} />
          ))}

          {blocks.length === 0 ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.3rem", color: "var(--text-muted)", fontSize: "var(--text-sm)", textAlign: "center", padding: "1rem" }}>
              <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Nothing on the timeline yet</span>
              <span style={{ fontSize: "var(--text-xs)" }}>Start a focus session or add calendar events to see blocks here.</span>
            </div>
          ) : (
            blocks.map((block) => {
              const isDragging = dragTopPct?.id === block.id;
              const top = isDragging ? dragTopPct!.pct : block.top;
              const canDrag = block.kind === "event" && !!onRescheduleEvent;
              return (
                <div
                  key={block.id}
                  title={canDrag ? `${block.title} — drag to reschedule` : block.title}
                  onMouseDown={(e) => onBlockMouseDown(e, block)}
                  style={{
                    position: "absolute",
                    top: `${top}%`,
                    left: block.lane === 0 ? "4%" : "52%",
                    width: "44%",
                    minHeight: "20px",
                    height: `${block.height}%`,
                    padding: "0.35rem 0.45rem",
                    borderRadius: "6px",
                    background: block.color,
                    opacity: isDragging ? 0.9 : block.color === "var(--accent)" ? 0.8 : 0.7,
                    color: "var(--text-inverted)",
                    fontSize: "var(--text-xs)",
                    overflow: "hidden",
                    cursor: canDrag ? "grab" : "default",
                    boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.25)" : "none",
                    zIndex: isDragging ? 10 : 1,
                    transition: isDragging ? "none" : "top 100ms ease",
                  }}
                >
                  {block.title}
                  {canDrag && <span style={{ float: "right", opacity: 0.6 }}>⠿</span>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

export default TimeBlocks;
