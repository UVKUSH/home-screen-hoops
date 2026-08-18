import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xMessage } from '../js/share.js';

// xMessage is deliberately free of `location` and the clipboard, so it can be
// checked here. The copy-and-open orchestration around it needs a browser.

test('a finished game names the score', () => {
  assert.match(xMessage({ score: 17, total: 24 }), /I got 17\/24\./);
});

test('with no game yet, it still reads as a post', () => {
  // the board panel's Share button exists before any score does
  const msg = xMessage();
  assert.doesNotMatch(msg, /I got/);
  assert.doesNotMatch(msg, /undefined|NaN|null/);
  assert.ok(msg.startsWith('Add this to your home screen'));
});

test('a zero-shot game is treated as no game, not as 0/0', () => {
  assert.equal(xMessage({ score: 0, total: 0 }), xMessage());
});

test('scoring zero out of a real total is still a score', () => {
  assert.match(xMessage({ score: 0, total: 24 }), /I got 0\/24\./);
});

// Installing is the thing worth converting on, and it is also the only way the
// gag works — in a browser tab the address bar gives it away immediately. So the
// post has to open with it, not bury it under a score.
test('every post leads with adding it to the home screen', () => {
  for (const msg of [xMessage(), xMessage({ score: 3, total: 24 })]) {
    assert.ok(msg.startsWith('Add this to your home screen'), 'leads with the install');
    assert.match(msg, /hold down the Search bar/i, 'says what to do once installed');
    assert.match(msg, /hand it to a friend/i, 'gives a reason to pass it on');
    assert.equal(msg.match(/hold down the Search bar/gi).length, 1, 'said once');
  }
});

// The score is the least important part: it means nothing to a stranger and it
// is not what we want them to do. It goes last, or the ask gets buried.
test('the score never comes before the ask', () => {
  const msg = xMessage({ score: 17, total: 24 });
  assert.ok(msg.indexOf('I got') > msg.indexOf('home screen'), 'install first');
  assert.ok(msg.indexOf('I got') > msg.indexOf('Search bar'), 'gag before the brag');
});

test('a post still fits X with the link appended', () => {
  const longest = xMessage({ score: 24, total: 24 });
  const withLink = `${longest}\n\nhttps://uvkush.github.io/home-screen-hoops/`;
  assert.ok(withLink.length <= 280, `${withLink.length} chars`);
});

// The link is appended for the clipboard only — X's intent carries it as its own
// `url` parameter, and having it in both would post the address twice.
test('the message carries no link of its own', () => {
  for (const msg of [xMessage(), xMessage({ score: 9, total: 24 })]) {
    assert.doesNotMatch(msg, /https?:\/\//);
  }
});

// ── which route the post takes out ───────────────────────────────
import { isPhone, xAppUrl } from '../js/share.js';

const nav = (userAgent, maxTouchPoints = 5) => ({ userAgent, maxTouchPoints });

test('phones and tablets get the app route', () => {
  for (const ua of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
  ]) assert.equal(isPhone(nav(ua)), true, ua.slice(0, 30));
});

// On desktop the web intent already opens a real composer in a new tab, which is
// fewer steps than anything an app scheme could do.
test('desktop keeps the web intent', () => {
  assert.equal(isPhone(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', 0)), false);
  assert.equal(isPhone(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', 0)), false);
});

// A touchscreen laptop is not a phone: no X app to catch the scheme, so firing
// it would do nothing and the composer would never open.
test('a touchscreen desktop is not treated as a phone', () => {
  assert.equal(isPhone(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', 10)), false);
});

test('the app url opens the composer and carries the whole post', () => {
  const url = xAppUrl('line one\n\nhttps://example.com/');
  assert.ok(url.startsWith('twitter://post?message='), url);
  assert.equal(decodeURIComponent(url.split('message=')[1]), 'line one\n\nhttps://example.com/');
});

// The scheme has no separate url parameter, so unlike the web intent the link
// has to be inside the message or it is lost.
test('the app url keeps the link, since the scheme has nowhere else to put it', () => {
  assert.match(xAppUrl('post\n\nhttps://uvkush.github.io/home-screen-hoops/'), /uvkush\.github\.io/);
});
