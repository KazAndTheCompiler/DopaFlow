import type { Task } from "../../../../shared/types";

interface EisenhowerViewProps { quadrants: { q1: Task[]; q2: Task[]; q3: Task[]; q4: Task[] } }

function cell(title: string, tasks: Task[]): JSX.Element {
  return <section style={{ padding: "1rem", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.6rem" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong>{title}</strong><span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{tasks.length}</span></div><div style={{ display: "grid", gap: "0.35rem" }}>{tasks.map((task) => <div key={task.id} style={{ fontSize: "var(--text-sm)" }}>{task.title}</div>)}</div></section>;
}

export default function EisenhowerView({ quadrants }: EisenhowerViewProps): JSX.Element {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>{cell("Q1 (Do)", quadrants.q1)}{cell("Q2 (Schedule)", quadrants.q2)}{cell("Q3 (Delegate)", quadrants.q3)}{cell("Q4 (Eliminate)", quadrants.q4)}</div>;
}
