import { useCallback, useEffect, useRef, useState } from "react";

import { resolveUrl } from "@api/player";
import { Skeleton } from "@ds/primitives/Skeleton";
import { showToast } from "@ds/primitives/Toast";

interface AlarmAudioPlayerProps {
  youtubeUrl: string;
  autoPlay?: boolean;
}

export function AlarmAudioPlayer({ youtubeUrl, autoPlay = false }: AlarmAudioPlayerProps): JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement>(null);
  const queueExhaustedRef = useRef(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sourceQueue, setSourceQueue] = useState<string[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);

  const skipToNext = useCallback((): void => {
    setSourceIndex((prev) => Math.min(prev + 1, sourceQueue.length));
  }, [sourceQueue]);

  useEffect(() => {
    if (!youtubeUrl) {
 return;
}

    let cancelled = false;

    const loadSources = async (): Promise<void> => {
      setLoading(true);
      setEmbedUrl(null);
      setSourceQueue([]);
      setSourceIndex(0);

      try {
        const parsed = new URL(youtubeUrl);
        const videoId = parsed.hostname.includes("youtu.be")
          ? parsed.pathname.slice(1)
          : (parsed.searchParams.get("v") ?? "");
        if (!videoId) {
          if (!cancelled) {
            setEmbedUrl(null);
            setSourceQueue([youtubeUrl]);
          }
          return;
        }

        const autoplayParam = autoPlay ? "1" : "0";
        const nextEmbedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplayParam}&rel=0`;
        const resolved = await resolveUrl(youtubeUrl).catch(() => ({ stream_url: null, error: "resolve_failed" }));
        const nextQueue = [resolved.stream_url, youtubeUrl].filter(
          (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
        );

        if (!cancelled) {
          setEmbedUrl(nextEmbedUrl);
          setSourceQueue(nextQueue);
        }
      } catch {
        if (!cancelled) {
          setEmbedUrl(null);
          setSourceQueue([youtubeUrl]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSources();

    return () => {
      cancelled = true;
    };
  }, [youtubeUrl, autoPlay]);

  useEffect(() => {
    const audio = audioRef.current;
    const activeSource = sourceQueue[sourceIndex];
    if (!audio) {
 return;
}
    if (!activeSource) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (sourceQueue.length > 0 && sourceIndex >= sourceQueue.length && !queueExhaustedRef.current) {
        queueExhaustedRef.current = true;
        showToast("Audio source unavailable — queue exhausted.", "warn");
      }
      return;
    }
    queueExhaustedRef.current = false;
    if (audio.src !== activeSource) {
      audio.src = activeSource;
      audio.load();
    }
    if (autoPlay) {
      void audio.play().catch(() => {});
    }
  }, [autoPlay, sourceIndex, sourceQueue]);

  if (!youtubeUrl) {
 return null;
}
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
      <audio
        ref={audioRef}
        onError={skipToNext}
        style={{ display: "none" }}
      />
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
