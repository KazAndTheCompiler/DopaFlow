import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { apiClient } from "@api/client";

const LS_KEY_URL = "dopaflow:turso_url";
const LS_KEY_TOKEN = "dopaflow:turso_token";

const inputStyle: CSSProperties = {
  padding: "0.4rem 0.65rem",
  borderRadius: "8px",
  border: "1px solid var(--border-subtle)",
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  fontSize: "var(--text-base)",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  marginBottom: "0.2rem",
  display: "block",
};

type TestState = "idle" | "testing" | "ok" | "error";

export function TursoConfig(): JSX.Element {
  const [url, setUrl] = useState<string>(
    () => localStorage.getItem(LS_KEY_URL) ?? "",
  );
  const [token, setToken] = useState<string>("");
  const [saved, setSaved] = useState<boolean>(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.removeItem(LS_KEY_TOKEN);
  }, []);

  const handleSave = (): void => {
    localStorage.setItem(LS_KEY_URL, url.trim());
    localStorage.removeItem(LS_KEY_TOKEN);
    setSaved(true);
    setTestState("idle");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async (): Promise<void> => {
    if (!url.trim() || !token.trim()) {
      return;
    }
    setTestState("testing");
    setTestError(null);
    try {
      const result = await apiClient<{ ok: boolean; error: string | null }>(
        "/ops/turso-test",
        {
          method: "POST",
          body: JSON.stringify({ url: url.trim(), token: token.trim() }),
        },
      );
      if (result.ok) {
        setTestState("ok");
      } else {
        setTestState("error");
        setTestError(result.error ?? "Connection failed");
      }
    } catch {
      setTestState("error");
      setTestError("Could not reach backend");
    }
  };

  const configured = Boolean(url.trim() && token.trim());

  return (
    <section
      style={{
        padding: "1.1rem 1.25rem",
        background: "var(--surface)",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.85rem",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 600 }}>Turso cloud backup</span>
          {configured && testState === "idle" && (
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--state-ok)",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                border: "1px solid currentColor",
              }}
            >
              configured
            </span>
          )}
          {testState === "ok" && (
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--state-ok)",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                border: "1px solid currentColor",
              }}
            >
              OK connected
            </span>
          )}
          {testState === "error" && (
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--state-overdue)",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                border: "1px solid currentColor",
              }}
            >
              ER failed
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Keep the database URL on this device, then paste a token only when
          testing the connection. Tokens are not stored in this browser.
        </span>
      </div>
      {testState === "error" && testError && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--state-overdue)",
            padding: "0.4rem 0.6rem",
            borderRadius: "8px",
            background:
              "color-mix(in srgb, var(--state-overdue) 10%, transparent)",
          }}
        >
          {testError}
        </div>
      )}

      <div style={{ display: "grid", gap: "0.25rem" }}>
        <label style={labelStyle}>Database URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="libsql://your-db.turso.io"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "grid", gap: "0.25rem" }}>
        <label style={labelStyle}>Auth token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJ..."
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={handleSave}
          style={{
            padding: "0.45rem 1.1rem",
            borderRadius: "8px",
            border: "none",
            background: "var(--accent)",
            color: "var(--text-inverted)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => void handleTest()}
          disabled={!configured || testState === "testing"}
          style={{
            padding: "0.45rem 1.1rem",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            cursor: configured ? "pointer" : "default",
            fontWeight: 500,
            opacity: configured ? 1 : 0.4,
          }}
        >
          {testState === "testing" ? "Testing…" : "Test connection"}
        </button>
      </div>
    </section>
  );
}

export default TursoConfig;
