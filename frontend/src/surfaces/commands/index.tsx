import { useEffect, useMemo, useState } from "react";

interface CommandDefinition {
  id: string;
  name: string;
  description: string;
  category?: string;
  text: string;
}

export default function CommandsView(): JSX.Element {
  const [search, setSearch] = useState("");
  const [commands, setCommands] = useState<CommandDefinition[]>([]);

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v2"}/commands/list`)
      .then((response) => response.json())
      .then((body: { commands: CommandDefinition[] }) => setCommands(Array.isArray(body.commands) ? body.commands : []))
      .catch(() => setCommands([]));
  }, []);

  const filtered = useMemo(
    () =>
      search
        ? commands.filter(
            (command) =>
              command.name.toLowerCase().includes(search.toLowerCase()) ||
              command.description.toLowerCase().includes(search.toLowerCase()),
          )
        : commands,
    [search, commands],
  );

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <input
        type="text"
        placeholder="Search commands..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: "1rem",
        }}
      />

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {filtered.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "2rem" }}>No commands found.</div>
        ) : (
          filtered.map((command) => (
            <article
              key={command.id}
              style={{
                padding: "1rem",
                borderRadius: "12px",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = "var(--accent)";
                event.currentTarget.style.background = "var(--surface-2)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = "var(--border-subtle)";
                event.currentTarget.style.background = "var(--surface)";
              }}
              onClick={() => {
                void fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v2"}/commands/execute`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: command.text }),
                });
              }}
            >
              <strong>{command.name}</strong>
              {command.category && (
                <span style={{ marginLeft: "0.5rem", fontSize: "var(--text-sm)", color: "var(--accent)" }}>[{command.category}]</span>
              )}
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>{command.description}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
