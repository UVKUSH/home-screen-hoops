import { test } from 'node:test';
import assert from 'node:assert/strict';

// install.js registers a beforeinstallprompt listener the moment it loads.
// Node has EventTarget but no global addEventListener, so stub it before the
// import — the same trick board.test.js uses for `document`.
globalThis.addEventListener = () => {};
const { script, detect } = await import('../js/install.js');

/**
 * Real user agent strings. Written out in full rather than reduced to the bit
 * that matches, because the point of this file is to catch a regex that stops
 * matching what phones actually send.
 */
const UA = {
  iosSafari:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iosChrome:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/604.1',
  iosEdge:    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0 Mobile/15E148 Safari/604.1',
  iosOpera:   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPT/4.5.0 Mobile/15E148 Safari/604.1',
  iPad:       'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidChrome:  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
  androidEdge:    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0',
  samsung:        'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  macSafari:  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  macChrome:  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  windows:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/** A desktop Mac and a touch iPad send the same UA; maxTouchPoints separates them. */
const nav = (userAgent, { platform = 'iPhone', maxTouchPoints = 5 } = {}) =>
  ({ userAgent, platform, maxTouchPoints });

const chose = (userAgent, navOpts) =>
  script({ nav: nav(userAgent, navOpts), nativePrompt: false }).id;

// ── which walkthrough each browser gets ─────────────────────────
const MATRIX = [
  ['iPhone Safari',    UA.iosSafari,      'ios-safari'],
  ['iPad Safari',      UA.iPad,           'ios-safari'],
  ['iPhone Chrome',    UA.iosChrome,      'ios-other'],
  ['iPhone Firefox',   UA.iosFirefox,     'ios-other'],
  ['iPhone Edge',      UA.iosEdge,        'ios-other'],
  ['iPhone Opera',     UA.iosOpera,       'ios-other'],
  ['Samsung Internet', UA.samsung,        'samsung'],
  ['Android Chrome',   UA.androidChrome,  'android'],
  ['Android Firefox',  UA.androidFirefox, 'android'],
  ['Android Edge',     UA.androidEdge,    'android'],
];

for (const [name, ua, expected] of MATRIX) {
  test(`${name} gets the ${expected} walkthrough`, () => {
    assert.equal(chose(ua), expected);
  });
}

test('desktop browsers fall through to "open it on your phone"', () => {
  for (const [name, ua] of [['mac safari', UA.macSafari], ['mac chrome', UA.macChrome],
                            ['windows', UA.windows]]) {
    // platform/touch values that a real desktop would report
    assert.equal(chose(ua, { platform: 'MacIntel', maxTouchPoints: 0 }), 'desktop', name);
  }
});

// A Mac and an iPad send byte-identical user agents. Only the touch points differ,
// and getting this backwards sends iPad users a "open this on your phone" dead end.
test('an iPad is told apart from a Mac by its touch points', () => {
  const macUA = UA.macSafari;
  assert.equal(chose(macUA, { platform: 'MacIntel', maxTouchPoints: 0 }), 'desktop');
  assert.equal(chose(macUA, { platform: 'MacIntel', maxTouchPoints: 5 }), 'ios-safari');
});

// ── the content each one carries ────────────────────────────────
test('only iPhone Safari draws the arrow at the bottom toolbar', () => {
  // it points at Safari's Share button, which is the one browser where it's down there
  for (const [, ua, id] of MATRIX) {
    const s = script({ nav: nav(ua), nativePrompt: false });
    assert.equal(Boolean(s.arrow), id === 'ios-safari', id);
  }
});

test('every walkthrough has a lead and two steps', () => {
  for (const [name, ua] of MATRIX) {
    const s = script({ nav: nav(ua), nativePrompt: false });
    assert.ok(s.lead?.length > 10, `${name} lead`);
    assert.equal(s.steps.length, 2, `${name} steps`);
    for (const step of s.steps) {
      assert.ok(step.icon.includes('<svg'), `${name} step icon`);
      assert.ok(step.text.length > 5, `${name} step text`);
    }
  }
});

test('Chrome on Android is told "three dots", Firefox is told "menu"', () => {
  // naming the wrong glyph is how these walkthroughs strand people
  const chrome = script({ nav: nav(UA.androidChrome), nativePrompt: false });
  const firefox = script({ nav: nav(UA.androidFirefox), nativePrompt: false });
  assert.match(chrome.steps[0].text, /three dots/);
  assert.match(firefox.steps[0].text, /menu/);
  assert.doesNotMatch(firefox.steps[0].text, /three dots/);
});

test('the iOS-other walkthrough sends them to Safari rather than giving steps they cannot follow', () => {
  const s = script({ nav: nav(UA.iosChrome), nativePrompt: false });
  assert.match(s.lead, /Safari/);
  assert.match(s.steps[0].text, /Safari/);
});

// ── the native prompt wins over everything ──────────────────────
test('a real install prompt replaces the instructions on any browser', () => {
  for (const [name, ua] of MATRIX) {
    const s = script({ nav: nav(ua), nativePrompt: true });
    assert.equal(s.id, 'native', name);
    assert.equal(s.steps.length, 0, `${name} should have no manual steps`);
    assert.equal(s.install, true, name);
  }
});

// ── detect() itself ─────────────────────────────────────────────
test('detect reports the flags the walkthroughs branch on', () => {
  assert.deepEqual(detect(nav(UA.iosSafari)),
    { ios: true, android: false, iosOtherBrowser: false, samsung: false, firefox: false });
  assert.deepEqual(detect(nav(UA.samsung)),
    { ios: false, android: true, iosOtherBrowser: false, samsung: true, firefox: false });
  assert.deepEqual(detect(nav(UA.androidFirefox)),
    { ios: false, android: true, iosOtherBrowser: false, samsung: false, firefox: true });
});

test('an unrecognisable user agent is not mistaken for a phone', () => {
  for (const ua of ['', 'curl/8.4.0', 'Mozilla/5.0 (compatible; Googlebot/2.1)']) {
    assert.equal(chose(ua, { platform: 'Linux x86_64', maxTouchPoints: 0 }), 'desktop',
      JSON.stringify(ua));
  }
});
