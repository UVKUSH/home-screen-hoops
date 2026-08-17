import { ANALYTICS } from './config.js';

/**
 * Cloudflare Web Analytics, if it's switched on.
 *
 * Counts by browser and device, which is the only thing being asked of it. It
 * sets no cookies and identifies nobody, so there is nothing here to disclose,
 * retain or delete — unlike the contact details, which have all three.
 *
 * The token lives in config.js rather than being pasted into index.html so that
 * an unconfigured build makes no request at all. A placeholder token in the
 * markup would fire a failing fetch on every visit instead.
 */
const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '']);

/**
 * What the beacon script should look like, or null for "don't load one".
 *
 * Pure, so the decision can be tested without a DOM — the injection below is
 * four lines of plumbing and this is the part with anything to get wrong.
 *
 * @param {string} [token]     empty means analytics are off
 * @param {string} [hostname]  dev traffic is not worth counting
 */
export function beaconAttrs(token = ANALYTICS.token, hostname = location.hostname) {
  const clean = String(token ?? '').trim();
  if (!clean) return null;
  // A hostname is already parsed, so plain equality is safe here — no prefix
  // matching to trip over the way an Origin string would.
  if (LOCAL_HOSTS.has(hostname)) return null;

  return {
    src: BEACON,
    defer: true,
    // JSON.stringify does the escaping, so a token with a quote in it can't
    // break out of the attribute
    'data-cf-beacon': JSON.stringify({ token: clean }),
  };
}

/** Add the beacon to the page. Returns the element, or null if it wasn't wanted. */
export function startAnalytics() {
  const attrs = beaconAttrs();
  if (!attrs) return null;
  if (document.querySelector(`script[src="${BEACON}"]`)) return null;   // already there

  const el = document.createElement('script');
  el.defer = attrs.defer;
  el.src = attrs.src;
  el.setAttribute('data-cf-beacon', attrs['data-cf-beacon']);
  document.head.appendChild(el);
  return el;
}
