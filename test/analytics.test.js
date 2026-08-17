import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beaconAttrs } from '../js/analytics.js';

// beaconAttrs takes its token and hostname as arguments, so the decision — load
// a beacon or not, and with what — is checkable without a DOM or a page.

const TOKEN = 'abc123def456';
const SITE = 'uvkush.github.io';

test('a configured token on a real host loads the beacon', () => {
  const a = beaconAttrs(TOKEN, SITE);
  assert.equal(a.src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.equal(a['data-cf-beacon'], JSON.stringify({ token: TOKEN }));
});

// Cloudflare ships and documents the beacon as a module. Loading it as a classic
// deferred script — the older documented form — may mean it never runs, and a
// beacon that silently doesn't fire looks exactly like a site with no visitors.
test('the beacon is loaded as a module', () => {
  const a = beaconAttrs(TOKEN, SITE);
  assert.equal(a.type, 'module');
  assert.equal(a.defer, undefined, 'type=module is already deferred');
});

// An unconfigured build must make no request at all. A placeholder token in the
// markup would fail on every visit instead, which is the reason this is gated.
test('no token means no beacon', () => {
  for (const t of [undefined, null, '', '   ', '\n']) {
    assert.equal(beaconAttrs(t, SITE), null, JSON.stringify(t));
  }
});

test('a token is trimmed before use, so a stray newline still works', () => {
  assert.equal(beaconAttrs(`  ${TOKEN}\n`, SITE)['data-cf-beacon'],
    JSON.stringify({ token: TOKEN }));
});

// Dev traffic would otherwise show up in the real numbers, and the request is
// pointless besides.
test('localhost is never counted', () => {
  for (const h of ['localhost', '127.0.0.1', '[::1]', '::1', '']) {
    assert.equal(beaconAttrs(TOKEN, h), null, h);
  }
});

// A hostname is already parsed by the time it reaches us, so equality is the
// right test — but it must be equality, not a prefix match.
test('a host that merely starts with localhost is a real host', () => {
  for (const h of ['localhost.example.com', 'notlocalhost', 'mylocalhost.dev']) {
    assert.ok(beaconAttrs(TOKEN, h), h);
  }
});

// The attribute is set with setAttribute, which never parses its value as
// markup, so there is no injection to escape. What matters is that the beacon
// can still parse the JSON: an unescaped quote would end the value early and
// the token would arrive truncated or not at all.
test('a token containing a quote still round-trips as JSON', () => {
  const nasty = 'x"}></script><script>alert(1)</script>';
  const attr = beaconAttrs(nasty, SITE)['data-cf-beacon'];

  assert.deepEqual(JSON.parse(attr), { token: nasty }, 'survives a round trip');
  // every quote from the token appears escaped, not raw
  assert.ok(attr.includes('\\"'), attr);
  assert.equal(attr.indexOf('"'), 1, 'the only unescaped quotes are JSON\'s own');
});

test('the beacon is the real Cloudflare one, over https', () => {
  const { src } = beaconAttrs(TOKEN, SITE);
  assert.ok(src.startsWith('https://'), src);
  assert.match(src, /^https:\/\/static\.cloudflareinsights\.com\//);
});
