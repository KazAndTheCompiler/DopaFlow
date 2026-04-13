import { useCallback, useEffect, useState } from 'react';

export type LayoutMode = 'comfortable' | 'compact' | 'expanded';

const LAYOUT_KEY = 'dopaflow:layout';
const DEFAULT_LAYOUT: LayoutMode = 'comfortable';

function resolveStoredLayout(): LayoutMode {
  const stored = window.localStorage.getItem(LAYOUT_KEY);
  if (stored === 'compact' || stored === 'expanded' || stored === 'comfortable') {
    return stored;
  }
  return DEFAULT_LAYOUT;
}

function applyLayout(mode: LayoutMode): void {
  document.documentElement.setAttribute('data-layout', mode);
}

export function useLayout(): {
  layout: LayoutMode;
  setLayout: (mode: LayoutMode) => void;
} {
  const [layout, setLayoutState] = useState<LayoutMode>(() => resolveStoredLayout());

  useEffect(() => {
    applyLayout(layout);
    window.localStorage.setItem(LAYOUT_KEY, layout);
  }, [layout]);

  const setLayout = useCallback((mode: LayoutMode) => {
    setLayoutState(mode);
  }, []);

  return { layout, setLayout };
}
