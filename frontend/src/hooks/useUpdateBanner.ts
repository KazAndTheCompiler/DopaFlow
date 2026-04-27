import { useEffect, useState } from "react";

declare const window: Window & {
  dopaflow?: {
    send: (channel: string, payload?: unknown) => void;
    on: (channel: string, callback: (payload: unknown) => void) => () => void;
    invoke?: (channel: string, payload?: unknown) => Promise<unknown>;
  };
};

interface UpdateInfo {
  version: string;
}

interface BuildInfo {
  version: string;
  releaseChannel: "stable" | "dev";
  autoUpdateEnabled: boolean;
  updateSource: "github-releases" | "manual";
}

interface UpdateState {
  available: boolean;
  downloaded: boolean;
  version: string | undefined;
  buildInfo?: BuildInfo | undefined;
}

export function useUpdateBanner(): UpdateState {
  const [state, setState] = useState<UpdateState>({
    available: false,
    downloaded: false,
    version: undefined,
    buildInfo: undefined,
  });

  useEffect(() => {
    if (!window.dopaflow) {
      return;
    }

    let active = true;

    void window.dopaflow.invoke?.("df:get-build-info").then((info) => {
      if (!active || !info) {
        return;
      }
      setState((prev) => ({ ...prev, buildInfo: info as BuildInfo }));
    });

    const unsubAvailable = window.dopaflow.on(
      "df:update-available",
      (info: unknown) => {
        const updateInfo = info as UpdateInfo | undefined;
        setState((prev) => ({
          ...prev,
          available: true,
          downloaded: false,
          version: updateInfo?.version ?? undefined,
        }));
      },
    );

    const unsubDownloaded = window.dopaflow.on("df:update-downloaded", () => {
      setState((prev) => ({ ...prev, downloaded: true }));
    });

    const unsubBuildInfo = window.dopaflow.on(
      "df:build-info",
      (info: unknown) => {
        setState((prev) => ({ ...prev, buildInfo: info as BuildInfo }));
      },
    );

    return () => {
      active = false;
      unsubAvailable();
      unsubDownloaded();
      unsubBuildInfo();
    };
  }, []);

  return state;
}

export function installUpdate(): void {
  window.dopaflow?.send("df:install-update");
}
