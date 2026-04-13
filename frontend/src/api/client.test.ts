import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('apiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function apiClient(path: string, init?: RequestInit) {
    const { apiClient: client } = await import('./client');
    return client(path, init);
  }

  describe('rate limiting', () => {
    it('throws rate_limited error on 429 response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 429, statusText: 'Too Many Requests' }),
      );

      await expect(apiClient('/test')).rejects.toThrow('rate_limited');
    });
  });

  describe('server errors', () => {
    it('throws server_error on 500', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

      await expect(apiClient('/test')).rejects.toThrow('server_error:500');
    });
  });

  describe('network errors', () => {
    it('retries once on network failure then throws with network_error prefix', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(apiClient('/test')).rejects.toThrow('network_error:');
    });
  });

  describe('4xx errors', () => {
    it('throws with parsed detail from JSON error body', async () => {
      const errorBody = JSON.stringify({ detail: 'Habit not found' });
      mockFetch.mockResolvedValueOnce(
        new Response(errorBody, {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await expect(apiClient('/test')).rejects.toThrow('API request failed: 404 Habit not found');
    });

    it('throws with status text when detail parsing fails', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }));

      await expect(apiClient('/test')).rejects.toThrow('API request failed: 404 Not Found');
    });
  });

  describe('successful responses', () => {
    it('returns parsed JSON on 200', async () => {
      const data = { id: 'tsk_123', title: 'Test task' };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await apiClient('/tasks/tsk_123');
      expect(result).toEqual(data);
    });

    it('returns undefined on 204', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const result = await apiClient('/test');
      expect(result).toBeUndefined();
    });

    it('returns undefined on empty content-length', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '0' },
        }),
      );

      const result = await apiClient('/test');
      expect(result).toBeUndefined();
    });

    it('returns text on text/plain response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('plain text response', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      );

      const result = await apiClient('/test');
      expect(result).toBe('plain text response');
    });
  });
});
