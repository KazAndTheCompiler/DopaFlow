import { useEffect, useState } from "react";

import { Skeleton } from "@ds/primitives/Skeleton";

interface AlarmAudioPlayerProps {
  youtubeUrl: string;
  autoPlay?: boolean;
}

export function AlarmAudioPlayer({ youtubeUrl, autoPlay = false }: AlarmAudioPlayerProps): JSX.Element | null {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!youtubeUrl) return;
    setLoading(true);
    setEmbedUrl(null);
    try {
      const parsed = new URL(youtubeUrl);
      const videoId = parsed.hostname.includes("youtu.be")
        ? parsed.pathname.slice(1)
        : (parsed.searchParams.get("v") ?? "");
      if (!videoId) {
        setEmbedUrl(null);
        setLoading(false);
        return;
      }
      const autoplayParam = autoPlay ? "1" : "0";
      setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=${autoplayParam}&rel=0`);
    } catch {
      setEmbedUrl(null);
    } finally {
      setLoading(false);
    }
  }, [youtubeUrl, autoPlay]);

  if (!youtubeUrl) return null;
  if (loading) {
    return (
      <div
        style={{
          marginTop: "0.5rem",
          padding: "0.65rem 0.75rem",
          borderRadius: "12px",
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          display: "grid",
          gap: "0.4rem",
        }}
      >
        <Skeleton width="132px" height="12px" />
        <Skeleton width="100%" height="36px" borderRadius="10px" />
      </div>
    );
  }
  if (!embedUrl) {
    return (
      <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
        <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          Could not embed this YouTube link directly.
        </div>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)", fontSize: "var(--text-sm)", fontWeight: 600 }}
        >
          Open YouTube link
        </a>
      </div>
    );
  }
  return (
    <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
      <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
        <iframe
          src={embedUrl}
          title="Alarm audio"
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      </div>
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noreferrer"
        style={{ color: "var(--accent)", fontSize: "var(--text-sm)", fontWeight: 600 }}
      >
        Open in YouTube
      </a>
    </div>
  );
}

export default AlarmAudioPlayer;
