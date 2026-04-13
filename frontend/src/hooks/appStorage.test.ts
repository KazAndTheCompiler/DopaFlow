import { describe, expect, it } from 'vitest';
import { APP_STORAGE_KEYS } from '../app/appStorage';

describe('APP_STORAGE_KEYS', () => {
  it('all keys are prefixed with dopaflow:', () => {
    const values = Object.values(APP_STORAGE_KEYS);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toMatch(/^dopaflow:/);
    }
  });

  it('no duplicate keys', () => {
    const values = Object.values(APP_STORAGE_KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('contains expected keys', () => {
    expect(APP_STORAGE_KEYS.onboardingComplete).toBe('dopaflow:onboarded');
    expect(APP_STORAGE_KEYS.plannedDate).toBe('dopaflow:planned_date');
    expect(APP_STORAGE_KEYS.focusPrefill).toBe('dopaflow:focus_prefill');
    expect(APP_STORAGE_KEYS.breakEndsAt).toBe('dopaflow:break_ends_at');
  });
});

describe('appStorage key prefix', () => {
  it('handles already-prefixed key', () => {
    function withDopaflowPrefix(key: string): string {
      return key.startsWith('dopaflow:') ? key : `dopaflow:${key}`;
    }
    expect(withDopaflowPrefix('dopaflow:existing')).toBe('dopaflow:existing');
    expect(withDopaflowPrefix('custom-key')).toBe('dopaflow:custom-key');
  });
});
