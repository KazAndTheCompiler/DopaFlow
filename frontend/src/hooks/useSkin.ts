import { useCallback, useEffect, useState } from 'react';

const SKIN_KEY = 'dopaflow:skin';
const DEFAULT_SKIN = 'ink-and-stone';
const CUSTOM_SKIN_KEY = 'dopaflow:custom_skin';
const SKINS_BASE = window.location.protocol === 'file:' ? './skins' : '/skins';

export interface SkinMeta {
  id: string;
  name: string;
  category: 'light' | 'dark';
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

const CUSTOM_SKIN_STYLE_ID = 'dopaflow-custom-skin-vars';

function readCustomSkin(): SkinDefinition | null {
  try {
    const raw = window.localStorage.getItem(CUSTOM_SKIN_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SkinDefinition>;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      !parsed.vars
    ) {
      return null;
    }
    const definition: SkinDefinition = {
      id: parsed.id,
      name: parsed.name,
      category: parsed.category === 'light' ? 'light' : 'dark',
      vars: parsed.vars,
    };
    if (parsed.author) {
      definition.author = parsed.author;
    }
    if (parsed.preview) {
      definition.preview = parsed.preview;
    }
    if (parsed.accessibility) {
      definition.accessibility = parsed.accessibility;
    }
    return definition;
  } catch {
    return null;
  }
}

function toSkinMeta(definition: SkinDefinition): SkinMeta {
  const meta: SkinMeta = {
    id: definition.id,
    name: definition.name,
    category: definition.category,
  };
  if (definition.preview) {
    meta.preview = definition.preview;
  }
  if (definition.accessibility) {
    meta.accessibility = definition.accessibility;
  }
  return meta;
}

export function saveCustomSkin(definition: {
  id: string;
  name: string;
  category: 'light' | 'dark';
  preview?: SkinMeta['preview'];
  accessibility?: string;
  author?: string;
  vars: Record<string, string>;
}): void {
  window.localStorage.setItem(CUSTOM_SKIN_KEY, JSON.stringify(definition));
}

function upsertSkinMeta(list: SkinMeta[], meta: SkinMeta): SkinMeta[] {
  const existingIndex = list.findIndex((skin) => skin.id === meta.id);
  if (existingIndex === -1) {
    return [...list, meta];
  }
  return list.map((skin, index) => (index === existingIndex ? meta : skin));
}

function migrateOldSkinKey(): void {
  const oldValue = window.localStorage.getItem('zoescal-skin');
  if (oldValue && !window.localStorage.getItem(SKIN_KEY)) {
    window.localStorage.setItem(SKIN_KEY, oldValue);
    window.localStorage.removeItem('zoescal-skin');
  }
}

function resolveStoredSkin(): string {
  migrateOldSkinKey();
  return window.localStorage.getItem(SKIN_KEY) ?? DEFAULT_SKIN;
}

function getSkinClassName(id: string): string {
  return `skin-${id}`;
}

function applySkinClass(id: string): void {
  const root = document.documentElement;
  const nextClassName = getSkinClassName(id);
  const preservedClasses = Array.from(root.classList).filter((name) => !name.startsWith('skin-'));
  root.className = [...preservedClasses, nextClassName].join(' ');
}

function applyCustomSkinVars(id: string, vars: Record<string, string>): void {
  let styleEl = document.getElementById(CUSTOM_SKIN_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_SKIN_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  const declarations = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  styleEl.textContent = `html.${getSkinClassName(id)} {\n${declarations}\n}`;
}

function clearCustomSkinVars(): void {
  document.getElementById(CUSTOM_SKIN_STYLE_ID)?.remove();
}

function loadSkin(id: string): void {
  applySkinClass(id);
  const customSkin = readCustomSkin();
  if (customSkin && customSkin.id === id) {
    applyCustomSkinVars(customSkin.id, customSkin.vars);
    return;
  }
  clearCustomSkinVars();
}

async function loadManifest(): Promise<SkinMeta[]> {
  try {
    const res = await fetch(`${SKINS_BASE}/manifest.json`);
    if (!res.ok) {
      throw new Error('manifest not found');
    }
    const m: SkinManifest = await res.json();
    const customSkin = readCustomSkin();
    if (customSkin && !m.skins.some((skin) => skin.id === customSkin.id)) {
      return [...m.skins, toSkinMeta(customSkin)];
    }
    return m.skins;
  } catch {
    const customSkin = readCustomSkin();
    if (customSkin) {
      return [toSkinMeta(customSkin)];
    }
    return [];
  }
}

export function useSkin(): {
  skin: string;
  skins: SkinMeta[];
  loading: boolean;
  setSkin: (id: string) => void;
} {
  const [skin, setSkinState] = useState<string>(() => resolveStoredSkin());
  const [skins, setSkins] = useState<SkinMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    void loadManifest()
      .then(setSkins)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSkin(skin);
    window.localStorage.setItem(SKIN_KEY, skin);
  }, [skin]);

  const setSkin = useCallback((id: string) => {
    const customSkin = readCustomSkin();
    if (customSkin && customSkin.id === id) {
      setSkins((current) => upsertSkinMeta(current, toSkinMeta(customSkin)));
    }
    setSkinState(id);
  }, []);

  return { skin, skins, loading, setSkin };
}
