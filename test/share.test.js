import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xMessage } from '../js/share.js';

// xMessage is deliberately free of `location` and the clipboard, so it can be
// checked here. The copy-and-open orchestration around it needs a browser.

test('a finished game names the score', () => {
  const msg = xMessage({ score: 17, total: 24 });
  assert.match(msg, /I scored 17\/24 on Home Screen Hoops/);
});

test('with no game yet, it still reads as a post', () => {
  // the board panel's Share button exists before any score does
  const msg = xMessage();
  assert.match(msg, /^Home Screen Hoops/);
  assert.doesNotMatch(msg, /scored/);
  assert.doesNotMatch(msg, /undefined|NaN|null/);
});

test('a zero-shot game is treated as no game, not as 0/0', () => {
  assert.equal(xMessage({ score: 0, total: 0 }), xMessage());
});

test('scoring zero out of a real total is still a score', () => {
  assert.match(xMessage({ score: 0, total: 24 }), /I scored 0\/24/);
});

test('the tagline is there, and only once', () => {
  for (const msg of [xMessage(), xMessage({ score: 3, total: 24 })]) {
    assert.match(msg, /Hold down the Search bar/);
    assert.equal(msg.match(/Hold down the Search bar/g).length, 1);
  }
});

// The link is appended for the clipboard only — X's intent carries it as its own
// `url` parameter, and having it in both would post the address twice.
test('the message carries no link of its own', () => {
  for (const msg of [xMessage(), xMessage({ score: 9, total: 24 })]) {
    assert.doesNotMatch(msg, /https?:\/\//);
  }
});
