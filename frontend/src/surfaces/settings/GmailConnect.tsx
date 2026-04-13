import { useEffect, useState } from "react";

import { connectGmail } from "@api/integrations";
import Button from "@ds/primitives/Button";
import { showToast } from "@ds/primitives/Toast";

const OAUTH_STATE_STORAGE_KEY = "dopaflow:oauth_state";

function removeOAuthParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  url.searchParams.delete("scope");
  url.searchParams.delete("authuser");
  url.searchParams.delete("prompt");
  window.history.replaceState({}, document.title, url.toString());
}

export function GmailConnect(): JSX.Element {
  const [status, setStatus] = useState<{ type: "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) {
 return;
}
    const callbackState = url.searchParams.get("state");
    const expectedState = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
    if (!callbackState || callbackState !== expectedState) {
      showToast("OAuth validation failed. Please try connecting Gmail again.", "error");
      setStatus({ type: "error", message: "OAuth validation failed. Please try connecting Gmail again." });
      sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
      removeOAuthParams();
      return;
    }
    const redirectUri = `${url.origin}${url.pathname}`;
    sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
    setLoading(true);
    setStatus(null);
    void connectGmail({ code, redirect_uri: redirectUri })
      .then((result) => {
        if (result.status !== "connected") {
          throw new Error(result.message ?? "Gmail connection failed.");
        }
        removeOAuthParams();
      })
      .catch((error: unknown) => {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Gmail connection failed." });
        removeOAuthParams();
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (): Promise<void> => {
    const state = crypto.randomUUID();
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);
    setLoading(true);
    setStatus(null);
    try {
      const result = await connectGmail({ redirect_uri: redirectUri, state });
      if (result.status === "redirect" && result.url) {
        window.location.href = result.url;
        return;
      }
      throw new Error(result.message ?? "Gmail connection failed.");
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Gmail connection failed." });
      sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.75rem", justifyItems: "start" }}>
      {status ? (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            fontSize: "var(--text-sm)",
            background: "color-mix(in srgb, var(--state-overdue) 12%, transparent)",
            color: "var(--state-overdue)",
          }}
        >
          {status.message}
        </div>
      ) : null}
      <Button onClick={() => void handleConnect()} disabled={loading}>{loading ? "Connecting…" : "Connect Gmail"}</Button>
    </div>
  );
}

export default GmailConnect;
