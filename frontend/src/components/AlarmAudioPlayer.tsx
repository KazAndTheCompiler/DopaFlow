import { useEffect, useState } from "react";

import { API_BASE_URL } from "../api/client";

interface AlarmAudioPlayerProps {
  youtubeUrl: string;
  autoPlay?: boolean;
}

export function AlarmAudioPlayer({ youtubeUrl, autoPlay = false }: AlarmAudioPlayerProps): JSX.Element | null {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!youtubeUrl) return;
    setLoading(true);
    setError(null);
    setStreamUrl(null);
    fetch(`${API_BASE_URL}/alarms/resolve-url?youtube_url=${encodeURIComponent(youtubeUrl)}`, { method: "POST" })
      .then(async (response) => ({ ok: response.ok, body: (await response.json()) as { stream_url?: string | null; error?: string | null } }))
      .then(({ ok, body }) => {
        if (!ok || !body.stream_url) throw new Error(body.error ?? "resolve_failed");
        setStreamUrl(body.stream_url);
      })
      .catch((exc: unknown) => setError(exc instanceof Error ? exc.message : "resolve_failed"))
      .finally(() => setLoading(false));
  }, [youtubeUrl]);

  if (!youtubeUrl) return null;
  if (loading) return <div style={{ marginTop: "0.5rem", fontSize: "var(--text-sm)" }}>Resolving stream…</div>;
  if (error) return <div style={{ marginTop: "0.5rem", color: "var(--state-error)", fontSize: "var(--text-sm)" }}>{`Could not load audio: ${error}`}</div>;
  return streamUrl ? <audio src={streamUrl} controls autoPlay={autoPlay} style={{ width: "100%", marginTop: "0.5rem" }} /> : null;
}

export default AlarmAudioPlayer;
