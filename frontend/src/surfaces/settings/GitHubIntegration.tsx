import { useEffect, useState } from "react";

import { importGitHubIssues } from "@api/integrations";
import Button from "@ds/primitives/Button";
import Input from "@ds/primitives/Input";

const STORAGE_KEY_TOKEN = "dopaflow:github_token";
const STORAGE_KEY_REPO = "dopaflow:github_repo";

const card: React.CSSProperties = {
  padding: "1rem 1.05rem",
  borderRadius: "20px",
  background: "color-mix(in srgb, var(--surface) 90%, white 10%)",
  border: "1px solid var(--border-subtle)",
  display: "grid",
  gap: "0.85rem",
  boxShadow: "var(--shadow-soft)",
};

const label: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.3rem",
  display: "block",
};

export default function GitHubIntegration(): JSX.Element {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(
    () => localStorage.getItem(STORAGE_KEY_REPO) ?? "",
  );
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  }, []);

  const handleImport = async (): Promise<void> => {
    if (!token.trim() || !repo.trim()) {
      setStatus({ type: "error", message: "Token and repo are required." });
      return;
    }
    localStorage.setItem(STORAGE_KEY_REPO, repo.trim());
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    setLoading(true);
    setStatus(null);
    try {
      const result = await importGitHubIssues({
        token: token.trim(),
        repo: repo.trim(),
        state,
      });
      setStatus({
        type: "success",
        message: `Imported ${result.created} issues as tasks (${result.skipped} skipped).`,
      });
    } catch (e) {
      setStatus({
        type: "error",
        message: e instanceof Error ? e.message : "Import failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "12px",
            display: "grid",
            placeItems: "center",
            background: "var(--surface-2)",
            color: "var(--accent)",
            fontSize: "0.7rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          GH
        </span>
        <strong>GitHub Issues</strong>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        Import open issues from any GitHub repo as tasks using a Personal Access
        Token (read:repo scope).
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        Tokens are used only for the current import and are not stored in this
        browser.
      </p>

      <div>
        <label style={label}>Personal Access Token</label>
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.currentTarget.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          autoComplete="off"
        />
      </div>

      <div>
        <label style={label}>Repository (owner/repo)</label>
        <Input
          type="text"
          value={repo}
          onChange={(e) => setRepo(e.currentTarget.value)}
          placeholder="acme/my-project"
        />
      </div>

      <div>
        <label style={label}>Issue state</label>
        <select
          value={state}
          onChange={(e) =>
            setState(e.currentTarget.value as "open" | "closed" | "all")
          }
          style={{
            width: "100%",
            cursor: "pointer",
            padding: "0.8rem 0.9rem",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontFamily: "inherit",
            fontSize: "var(--text-sm)",
          }}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>

      {status && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            fontSize: "var(--text-sm)",
            background:
              status.type === "success"
                ? "color-mix(in srgb, var(--state-ok) 12%, transparent)"
                : "color-mix(in srgb, var(--state-overdue) 12%, transparent)",
            color:
              status.type === "success"
                ? "var(--state-ok)"
                : "var(--state-overdue)",
          }}
        >
          {status.message}
        </div>
      )}

      <Button
        onClick={() => void handleImport()}
        disabled={loading}
        style={{ justifySelf: "start" }}
      >
        {loading ? "Importing…" : "Import issues"}
      </Button>
    </div>
  );
}
