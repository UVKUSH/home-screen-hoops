import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.addEventListener = () => {};          // install.js registers one at load
const { introAllowed } = await import('../js/splash.js');

const nav = (userAgent, platform = 'iPhone', maxTouchPoints = 5) =>
  ({ userAgent, platform, maxTouchPoints });

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1';
const MAC        = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const ANDROID    = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';

// The sting cannot play on iOS, and creating the element claims the audio
// session — which silences the AudioContext every sound in the GAME runs
// through. Trading all of the game's audio for a flourish that never plays is
// the regression this guards.
test('no intro element is ever made on iOS', () => {
  assert.equal(introAllowed(nav(IOS_SAFARI)), false, 'iPhone Safari');
  assert.equal(introAllowed(nav(IOS_CHROME)), false, 'iPhone Chrome');
});

test('an iPad counts as iOS, Mac user agent notwithstanding', () => {
  // identical UA to a Mac; only the touch points separate them
  assert.equal(introAllowed(nav(MAC, 'MacIntel', 5)), false, 'iPad');
  assert.equal(introAllowed(nav(MAC, 'MacIntel', 0)), true, 'actual Mac');
});

test('everywhere else still gets the sting', () => {
  assert.equal(introAllowed(nav(ANDROID, 'Linux', 5)), true, 'Android');
  assert.equal(introAllowed(nav(MAC, 'MacIntel', 0)), true, 'desktop Safari');
});
