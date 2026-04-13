import { describe, expect, it } from 'vitest';
import { getInvalidationEventName } from './useSSE';

describe('getInvalidationEventName', () => {
  it('returns correctly namespaced event for each domain', () => {
    expect(getInvalidationEventName('alarms')).toBe('dopaflow:invalidate:alarms');
    expect(getInvalidationEventName('calendar')).toBe('dopaflow:invalidate:calendar');
    expect(getInvalidationEventName('habits')).toBe('dopaflow:invalidate:habits');
    expect(getInvalidationEventName('journal')).toBe('dopaflow:invalidate:journal');
    expect(getInvalidationEventName('tasks')).toBe('dopaflow:invalidate:tasks');
  });
});
