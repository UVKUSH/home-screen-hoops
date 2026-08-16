import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBall, stepBall, separate, timeToRim } from '../js/physics.js';

// A stand-in for a 375x812 phone. createWorld() needs a browser, stepBall doesn't.
const world = () => ({ w: 375, h: 812, g: 3.1 * 812, gx: 0, floor: 808 });
const hoop  = { x: 97, y: 244, rimHalf: 67, postR: 4 };

const DT = 1 / 60;

/** Run the sim, collecting every event, until `done` or we run out of patience. */
function simulate(b, w, h, done, maxSeconds = 6) {
  const events = [];
  for (let i = 0; i < maxSeconds * 60; i++) {
    const ev = stepBall(b, w, h, DT);
    if (ev) events.push(ev);
    if (done(b)) break;
  }
  return events;
}

test('a ball dropping through the rim scores exactly once', () => {
  const w = world();
  const b = makeBall(null, hoop.x, hoop.y - 120, 31);
  b.vy = 150; // already falling

  const events = simulate(b, w, hoop, (ball) => ball.y > hoop.y + 200);
  assert.equal(events.filter((e) => e === 'score').length, 1);
});

test('a ball pushed UP through the net does not score on the way up', () => {
  const w = world();
  const b = makeBall(null, hoop.x, hoop.y + 150, 31);
  b.vy = -1400; // fired straight up from underneath

  // stop the moment it clears the rim, before gravity brings it back down
  const events = simulate(b, w, hoop, (ball) => ball.y < hoop.y - 60);
  assert.ok(b.y < hoop.y, 'ball should have risen past the rim');
  assert.equal(events.includes('score'), false);
});

test('a ball falling wide of the rim does not score', () => {
  const w = world();
  const b = makeBall(null, hoop.x + hoop.rimHalf + 90, hoop.y - 120, 31);
  b.vy = 150;

  const events = simulate(b, w, hoop, (ball) => ball.y > hoop.y + 200);
  assert.equal(events.includes('score'), false);
});

test('a ball clipping the rim post is deflected sideways', () => {
  const w = world();
  // Offset from the post on purpose: a ball dropped dead-centre onto a post
  // bounces straight back up, which is correct but tests nothing.
  const b = makeBall(null, hoop.x + hoop.rimHalf + 14, hoop.y - 90, 31);
  b.vy = 400;
  b.vx = 0;

  simulate(b, w, hoop, (ball) => ball.y > hoop.y + 120);
  assert.ok(Math.abs(b.vx) > 50, `expected a clang, got vx=${b.vx.toFixed(1)}`);
});

test('a dropped ball settles on the floor instead of falling through it', () => {
  const w = world();
  const b = makeBall(null, 180, 100, 31);

  simulate(b, w, null, () => false, 5);
  assert.ok(b.y + b.r <= w.floor + 1, 'ball stayed above the floor');
  assert.ok(Math.abs(b.vy) < 60, `expected it to come to rest, vy=${b.vy.toFixed(1)}`);
});

test('tilting the phone rolls a resting ball sideways', () => {
  const w = world();
  const b = makeBall(null, 180, w.floor - 31, 31);

  simulate(b, w, null, () => false, 1);   // let it settle flat
  const restX = b.x;

  w.gx = 0.55 * w.g;                      // lean right
  simulate(b, w, null, () => false, 1);
  assert.ok(b.x > restX + 20, `expected it to roll right, moved ${(b.x - restX).toFixed(1)}px`);
});

test('a ball never escapes sideways through the screen edge', () => {
  const w = world();
  const b = makeBall(null, 60, 300, 31);
  b.vx = -4000;

  simulate(b, w, null, () => false, 2);
  assert.ok(b.x - b.r >= -0.5 && b.x + b.r <= w.w + 0.5, `escaped to x=${b.x.toFixed(1)}`);
});

test('timeToRim predicts the DOWNWARD crossing, matching the real integrator', () => {
  const w = world();
  const dy = 308;                       // ball starts this far below the rim
  const vy = -1438;                     // a decent flick upward

  const predicted = timeToRim(vy, dy, w.g);
  assert.ok(predicted !== null, 'shot should reach the rim');

  // now actually fly it and time the descending crossing
  const b = makeBall(null, 187, hoop.y + dy, 31);
  b.vy = vy;
  let elapsed = 0;
  let crossed = null;
  for (let i = 0; i < 600; i++) {
    const prev = b.y;
    stepBall(b, w, null, DT);
    elapsed += DT;
    if (prev <= hoop.y && b.y > hoop.y) { crossed = elapsed; break; }
  }

  assert.ok(crossed !== null, 'ball never came back down through rim height');
  assert.ok(
    Math.abs(crossed - predicted) < 0.05,
    `predicted ${predicted.toFixed(3)}s but it actually took ${crossed.toFixed(3)}s`,
  );
});

test('timeToRim gives up on a shot that never reaches the rim', () => {
  assert.equal(timeToRim(-200, 308, world().g), null);
});

test('a flick aimed with timeToRim actually goes in', () => {
  const w = world();
  // the real launch corner (0.76 of a 375px screen), not screen centre —
  // from centre the ball clips the near post on the way up, by design
  const startX = 285, startY = 552;
  const vy = -1438;

  const t = timeToRim(vy, startY - hoop.y, w.g);
  const vx = (hoop.x - startX) / t;      // exactly the lead the assist computes

  const b = makeBall(null, startX, startY, 31);
  b.vx = vx;
  b.vy = vy;

  // run it out rather than stopping "once it's below the rim" — it starts
  // below the rim, so that condition is already true on frame one
  const events = simulate(b, w, hoop, () => false, 4);
  assert.ok(events.includes('score'), 'a perfectly-led shot should drop through');
});

test('overlapping balls get pushed apart', () => {
  const a = makeBall(null, 100, 100, 31);
  const b = makeBall(null, 110, 100, 31);   // badly overlapping

  separate([a, b]);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > 10, 'balls should have separated');
});
