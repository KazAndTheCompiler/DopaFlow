/// <reference types="vite/client" />

interface UpdateInfo {
  version: string;
}

interface DopaFlowAPI {
  send: (channel: string, payload?: unknown) => void;
  on: (channel: string, callback: (payload: unknown) => void) => () => void;
}

declare global {
  interface Window {
    dopaflow?: DopaFlowAPI;
  }
}
