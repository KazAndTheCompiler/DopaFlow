import { installUpdate } from "../hooks/useUpdateBanner";

export function TopBarReleaseBanner({
  version,
  downloaded,
}: {
  version: string | undefined;
  downloaded: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        background: downloaded ? "var(--state-ok)" : "var(--accent)",
        color: "white",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontSize: "var(--text-sm)",
      }}
    >
      <span>
        {downloaded
          ? `Version ${version} is ready to install`
          : `Version ${version} is available`}
      </span>
      {downloaded ? (
        <button
          onClick={installUpdate}
          style={{
            background: "white",
            color: "var(--state-ok)",
            border: "none",
            borderRadius: "6px",
            padding: "0.25rem 0.75rem",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "var(--text-xs)",
          }}
        >
          Install & Restart
        </button>
      ) : (
        <span style={{ fontSize: "var(--text-xs)", opacity: 0.9 }}>
          Downloading...
        </span>
      )}
    </div>
  );
}

export function TopBarChannelBanner({
  version,
  releaseChannel,
}: {
  version: string | undefined;
  releaseChannel: "stable" | "dev" | undefined;
}): JSX.Element {
  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--surface) 86%, black 14%)",
        color: "var(--text-primary)",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        fontSize: "var(--text-sm)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span>
        {releaseChannel === "dev"
          ? `Dev build ${version}: updates are manual. Paid stable builds use automatic updates from GitHub Releases.`
          : `Build ${version}: automatic updates are disabled for this channel.`}
      </span>
    </div>
  );
}
