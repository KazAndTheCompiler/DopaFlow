import { useCallback, useEffect, useState } from "react";

const SKIN_KEY = "zoestm-skin";
const DEFAULT_SKIN = "ink-and-stone";
// In packaged Electron the frontend is loaded via file://, so absolute paths
// resolve to the filesystem root instead of the app bundle. Use a relative
// path in that context so fetch resolves relative to index.html in dist/.
const SKINS_BASE = window.location.protocol === "file:" ? "./skins" : "/skins";

export interface SkinMeta {
  id: string;
  name: string;
  category: "light" | "dark";
  default?: boolean;
  accessibility?: string;
  preview?: { bg: string; accent: string; surface: string };
}

interface SkinManifest {
  version: string;
  skins: SkinMeta[];
  customSkinSupport: boolean;
}

interface SkinDefinition extends SkinMeta {
  author?: string;
  vars: Record<string, string>;
}

function migrateOldSkinKey(): void {
  const oldValue = window.localStorage.getItem("zoescal-skin");
  if (oldValue && !window.localStorage.getItem(SKIN_KEY)) {
    window.localStorage.setItem(SKIN_KEY, oldValue);
    window.localStorage.removeItem("zoescal-skin");
  }
}

function resolveStoredSkin(): string {
  migrateOldSkinKey();
  return window.localStorage.getItem(SKIN_KEY) ?? DEFAULT_SKIN;
}

function applyVars(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.removeAttribute("data-skin");
}

async function loadSkin(id: string): Promise<void> {
  // Apply CSS attribute immediately so the skin is visible before the JSON fetch resolves
  document.documentElement.setAttribute("data-skin", id);
  try {
    const res = await fetch(`${SKINS_BASE}/${id}.json`);
    if (!res.ok) throw new Error(`not found`);
    const def: SkinDefinition = await res.json();
    applyVars(def.vars);
  } catch {
    // CSS attribute-based fallback already applied above
  }
}

async function loadManifest(): Promise<SkinMeta[]> {
  try {
    const res = await fetch(`${SKINS_BASE}/manifest.json`);
    if (!res.ok) throw new Error("manifest not found");
    const m: SkinManifest = await res.json();
    return m.skins;
  } catch {
    return [];
  }
}

export function useSkin(): {
  skin: string;
  skins: SkinMeta[];
  setSkin: (id: string) => void;
} {
  const [skin, setSkinState] = useState<string>(() => resolveStoredSkin());
  const [skins, setSkins] = useState<SkinMeta[]>([]);

  useEffect(() => {
    void loadManifest().then(setSkins);
  }, []);

  useEffect(() => {
    void loadSkin(skin);
    window.localStorage.setItem(SKIN_KEY, skin);
  }, [skin]);

  const setSkin = useCallback((id: string) => {
    setSkinState(id);
  }, []);

  return { skin, skins, setSkin };
}
