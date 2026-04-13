export type ToastType = 'success' | 'error' | 'info' | 'warn';

interface ToastDetail {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 0;

function dispatchToast(message: string, type: ToastType): void {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>('dopaflow:toast', {
      detail: { id: ++nextId, message, type },
    }),
  );
}

export function fire(message: string, type: 'error' | 'warn' | 'success'): void {
  dispatchToast(message, type);
}

export function show(message: string, type: ToastType = 'info'): void {
  dispatchToast(message, type);
}
