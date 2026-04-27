import { useEffect, useState } from "react";

import {
  getVaultConflictPreview,
  getVaultConflicts,
  getVaultStatus,
  resolveVaultConflict,
  rollbackVaultFile,
  updateVaultConfig,
} from "@api/index";
import type {
  VaultConflictPreview,
  VaultFileRecord,
  VaultStatus,
} from "../../../../shared/types";

type SyncState = "idle" | "working" | "done" | "error";

type SyncResult = {
  pushed?: number;
  pulled?: number;
  imported?: number;
  updated?: number;
  conflicts?: number;
  errors: string[];
};

export function useVaultSettings(): {
  status: VaultStatus | null;
  conflicts: VaultFileRecord[];
  conflictPreviews: Record<string, VaultConflictPreview | undefined>;
  previewErrorById: Record<string, string | undefined>;
  loadingPreviewId: string | null;
  pathInput: string;
  enabledInput: boolean;
  syncState: SyncState;
  lastMessage: string | null;
  loading: boolean;
  busy: boolean;
  active: boolean;
  setPathInput: (value: string) => void;
  setEnabledInput: (value: boolean) => void;
  saveConfig: () => void;
  run: (label: string, fn: () => Promise<SyncResult>) => void;
  doRollback: (id: string) => void;
  doResolve: (filePath: string) => void;
  togglePreview: (recordId: string) => void;
} {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [conflicts, setConflicts] = useState<VaultFileRecord[]>([]);
  const [conflictPreviews, setConflictPreviews] = useState<
    Record<string, VaultConflictPreview | undefined>
  >({});
  const [previewErrorById, setPreviewErrorById] = useState<
    Record<string, string | undefined>
  >({});
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [enabledInput, setEnabledInput] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = (): void => {
    setLoading(true);
    void Promise.all([getVaultStatus(), getVaultConflicts()])
      .then(([nextStatus, nextConflicts]) => {
        setStatus(nextStatus);
        setConflicts(nextConflicts);
        setPathInput(nextStatus.config.vault_path);
        setEnabledInput(nextStatus.config.vault_enabled);
      })
      .catch((error: unknown) => {
        setLastMessage(
          `Vault refresh failed: ${error instanceof Error ? error.message : "unknown"}`,
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveConfig = (): void => {
    void updateVaultConfig({
      vault_path: pathInput,
      vault_enabled: enabledInput,
    })
      .then(() => {
        setLastMessage("Settings saved.");
        refresh();
      })
      .catch((error: unknown) => {
        setLastMessage(
          `Error: ${error instanceof Error ? error.message : "unknown"}`,
        );
      });
  };

  const run = (label: string, fn: () => Promise<SyncResult>): void => {
    setSyncState("working");
    setLastMessage(null);
    void fn()
      .then((result) => {
        setSyncState("done");
        const count =
          result.pushed ?? (result.imported ?? 0) + (result.updated ?? 0);
        let message = `${label}: ${count} synced`;
        if (result.conflicts) {
          message += ` · ${result.conflicts} conflicts`;
        }
        if (result.errors.length) {
          message += `\n${result.errors.slice(0, 3).join("; ")}`;
        }
        setLastMessage(message);
        refresh();
      })
      .catch((error: unknown) => {
        setSyncState("error");
        setLastMessage(
          `${label} failed: ${error instanceof Error ? error.message : "unknown"}`,
        );
      });
  };

  const doRollback = (id: string): void => {
    void rollbackVaultFile(id)
      .then((result) => {
        setLastMessage(result.message);
        refresh();
      })
      .catch((error: unknown) => {
        setLastMessage(
          `Rollback failed: ${error instanceof Error ? error.message : "unknown"}`,
        );
      });
  };

  const doResolve = (filePath: string): void => {
    void resolveVaultConflict(filePath)
      .then(() => {
        setLastMessage("Conflict resolved.");
        refresh();
      })
      .catch((error: unknown) => {
        setLastMessage(
          `Resolve failed: ${error instanceof Error ? error.message : "unknown"}`,
        );
      });
  };

  const togglePreview = (recordId: string): void => {
    if (conflictPreviews[recordId]) {
      setConflictPreviews((current) => ({ ...current, [recordId]: undefined }));
      setPreviewErrorById((current) => ({ ...current, [recordId]: undefined }));
      return;
    }

    setLoadingPreviewId(recordId);
    setPreviewErrorById((current) => ({ ...current, [recordId]: undefined }));
    void getVaultConflictPreview(recordId)
      .then((preview) => {
        setConflictPreviews((current) => ({ ...current, [recordId]: preview }));
      })
      .catch((error: unknown) => {
        setPreviewErrorById((current) => ({
          ...current,
          [recordId]: error instanceof Error ? error.message : "Preview failed",
        }));
      })
      .finally(() =>
        setLoadingPreviewId((current) =>
          current === recordId ? null : current,
        ),
      );
  };

  return {
    status,
    conflicts,
    conflictPreviews,
    previewErrorById,
    loadingPreviewId,
    pathInput,
    enabledInput,
    syncState,
    lastMessage,
    loading,
    busy: syncState === "working",
    active: Boolean(status?.vault_reachable && status?.config.vault_enabled),
    setPathInput,
    setEnabledInput,
    saveConfig,
    run,
    doRollback,
    doResolve,
    togglePreview,
  };
}
