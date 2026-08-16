import { API } from './config.js';

const TIMEOUT_MS = 9000;

/** No backend configured means no leaderboard UI at all. */
export const leaderboardOn = () => Boolean(API.apiBase);

async function call(path, options = {}) {
  const res = await fetch(API.apiBase + path, {
    ...options,
    headers: { 'content-type': 'application/json' },
    // a backend that never answers shouldn't leave the player on a spinner
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    /* a non-JSON error page is handled below */
  }

  if (!res.ok) throw new Error(body?.error || `Couldn't reach the leaderboard (${res.status})`);
  return body ?? {};
}

export const fetchTop = () => call('/api/top');

export const submitScore = (entry) =>
  call('/api/score', { method: 'POST', body: JSON.stringify(entry) });
