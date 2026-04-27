import { useState } from "react";

import Button from "@ds/primitives/Button";
import { API_BASE_URL } from "../../api/client";

const BASE = API_BASE_URL;

export default function WebhookPanel(): JSX.Element {
  const [copied, setCopied] = useState(false);
  const url = `${BASE}/integrations/webhooks/outbox`;

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "16px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.75rem",
      }}
    >
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
          WH
        </span>
        <strong>Zapier / n8n / Webhook</strong>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        POST to this URL to create tasks from any external service. Send JSON
        with <code>{"{ event_type, payload }"}</code>.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <code
          style={{
            flex: 1,
            padding: "0.55rem 0.75rem",
            borderRadius: "8px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {url}
        </code>
        <Button
          onClick={handleCopy}
          variant={copied ? "primary" : "secondary"}
          style={{
            fontSize: "var(--text-xs)",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied OK" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
