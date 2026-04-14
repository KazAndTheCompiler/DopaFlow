import { describe, expect, it, vi } from 'vitest';
import { fire, show } from './toastService';

describe('toastService', () => {
  it('fire dispatches error toast event', () => {
    const listener = vi.fn();
    window.addEventListener('dopaflow:toast', listener);

    fire('Something went wrong', 'error');

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.message).toBe('Something went wrong');
    expect(event.detail.type).toBe('error');
    expect(event.detail.id).toBeGreaterThan(0);

    window.removeEventListener('dopaflow:toast', listener);
  });

  it('fire dispatches warn toast event', () => {
    const listener = vi.fn();
    window.addEventListener('dopaflow:toast', listener);

    fire('Slow down', 'warn');

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.message).toBe('Slow down');
    expect(event.detail.type).toBe('warn');

    window.removeEventListener('dopaflow:toast', listener);
  });

  it('fire dispatches success toast event', () => {
    const listener = vi.fn();
    window.addEventListener('dopaflow:toast', listener);

    fire('Saved!', 'success');

    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.type).toBe('success');

    window.removeEventListener('dopaflow:toast', listener);
  });

  it('show dispatches toast with info type by default', () => {
    const listener = vi.fn();
    window.addEventListener('dopaflow:toast', listener);

    show('Hello there');

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.message).toBe('Hello there');
    expect(event.detail.type).toBe('info');

    window.removeEventListener('dopaflow:toast', listener);
  });

  it('show dispatches toast with explicit type', () => {
    const listener = vi.fn();
    window.addEventListener('dopaflow:toast', listener);

    show('Warning', 'warn');

    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.type).toBe('warn');

    window.removeEventListener('dopaflow:toast', listener);
  });
});
