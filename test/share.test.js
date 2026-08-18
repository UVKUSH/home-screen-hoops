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
  assert.ok(msg.startsWith('Looks exactly like an iPhone home screen'));
});

test('a zero-shot game is treated as no game, not as 0/0', () => {
  assert.equal(xMessage({ score: 0, total: 0 }), xMessage());
});

test('scoring zero out of a real total is still a score', () => {
  assert.match(xMessage({ score: 0, total: 24 }), /I got 0\/24\./);
});

// The post has a job: say what the thing is, say what to do with it, and give a
// reason to pass it on. Someone who reads it should know to hold the Search bar
// without opening the link first — a share that needs explaining doesn't travel.
test('every post says what it is, what to do, and why to pass it on', () => {
  for (const msg of [xMessage(), xMessage({ score: 3, total: 24 })]) {
    assert.match(msg, /iPhone home screen/, 'says what it is');
    assert.match(msg, /hold down the Search bar/i, 'says what to do');
    assert.match(msg, /Hand it to someone/, 'gives a reason to pass it on');
    assert.equal(msg.match(/hold down the Search bar/gi).length, 1, 'said once');
  }
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
