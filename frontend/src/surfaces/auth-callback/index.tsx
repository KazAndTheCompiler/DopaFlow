import { useEffect, useRef } from 'react';

import { handleCallback, handleDeepLinkUrl } from '../../api/auth';

function extractParamsFromHash(): { code?: string; state?: string } {
  const hash = window.location.hash;
  if (!hash.includes('?')) {
    return {};
  }
  const queryString = hash.slice(hash.indexOf('?') + 1);
  const params = new URLSearchParams(queryString);
  const code = params.get('code');
  const state = params.get('state');
  const result: { code?: string; state?: string } = {};
  if (code) {
 result.code = code;
}
  if (state) {
 result.state = state;
}
  return result;
}

export default function AuthCallbackView(): JSX.Element {
  const processedRef = useRef<boolean>(false);

  useEffect(() => {
    if (processedRef.current) {
      return;
    }
    const hashParams = extractParamsFromHash();
    if (hashParams.code || hashParams.state) {
      processedRef.current = true;
      void handleCallback(hashParams).then((ok) => {
        if (ok) {
          window.location.hash = '#/today';
        } else {
          window.location.hash = '#/today?auth=error';
        }
      });
      return;
    }
    const dopaflow = (globalThis as { dopaflow?: { on: (channel: string, callback: (payload: unknown) => void) => () => void } }).dopaflow;
    const cleanup = dopaflow?.on('deep-link', (rawUrl: unknown) => {
      if (processedRef.current) {
        return;
      }
      processedRef.current = true;
      handleDeepLinkUrl(rawUrl as string);
      void handleCallback().then((ok) => {
        window.location.hash = ok ? '#/today' : '#/today?auth=error';
      });
    });
    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100vh',
        gap: '1rem',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
        Completing sign in…
      </div>
    </div>
  );
}
