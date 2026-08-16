import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBall, stepBall, separate, settle, timeToRim } from '../js/physics.js';

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

// The sound layer reads b.hit after every step, so the physics has to report
// impacts even though it knows nothing about audio.
test('a floor bounce is reported, and scaled by how hard it landed', () => {
  const w = world();
  // step until each one actually reaches the floor — one frame at 200px/s
  // doesn't cover the gap
  const land = (vy) => {
    const b = makeBall(null, 180, w.floor - 31 - 5, 31);
    b.vy = vy;
    for (let i = 0; i < 30; i++) {
      stepBall(b, w, null, DT);
      if (b.hit) return b.hit;
    }
    return null;
  };

  const soft = land(200);
  const hard = land(1600);

  assert.equal(soft?.type, 'floor');
  assert.equal(hard?.type, 'floor');
  assert.ok(hard.speed > soft.speed * 3, 'a harder landing must report louder');
});

test('a rim clang is reported as a rim hit, not a floor one', () => {
  const w = world();
  const b = makeBall(null, hoop.x + hoop.rimHalf + 14, hoop.y - 90, 31);
  b.vy = 400;

  let seen = null;
  for (let i = 0; i < 60 && !seen; i++) {
    stepBall(b, w, hoop, DT);
    if (b.hit) seen = b.hit;
  }
  assert.equal(seen?.type, 'rim');
  assert.ok(seen.speed > 0);
});

test('a ball floating in mid-air reports no impact', () => {
  const w = world();
  const b = makeBall(null, 180, 200, 31);
  stepBall(b, w, null, DT);
  assert.equal(b.hit, null);
});

test('overlapping balls get pushed apart', () => {
  const a = makeBall(null, 100, 100, 31);
  const b = makeBall(null, 110, 100, 31);   // badly overlapping

  separate([a, b]);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > 10, 'balls should have separated');
});

test('a pinned ball does the shoving and is never shoved', () => {
  const finger = makeBall(null, 100, 100, 31);
  const loose  = makeBall(null, 110, 100, 31);
  finger.pinned = true;

  // separation eases out over frames rather than snapping, so run it the way
  // the game does
  for (let i = 0; i < 30; i++) separate([finger, loose]);

  assert.equal(finger.x, 100, 'the ball under the finger must not move');
  assert.equal(finger.y, 100);
  assert.ok(loose.x > 110, 'the loose ball takes the whole displacement');
  assert.ok(
    Math.hypot(loose.x - finger.x, loose.y - finger.y) >= 61,
    'and ends up all but clear — a little overlap is tolerated on purpose',
  );
});

// A settled pile that never sleeps jitters, spins and clicks forever — this is
// the bug that showed up the moment the whole pile became live.
test('a pile that has come to rest falls asleep and stops making noise', () => {
  const w = world();
  const pile = [0, 1, 2].map((i) => makeBall(null, 150 + i * 62, w.floor - 31, 31));

  for (let i = 0; i < 240; i++) {          // four seconds
    for (const b of pile) stepBall(b, w, null, DT);
    separate(pile);
    settle(pile, DT);
  }

  assert.ok(pile.every((b) => b.asleep), 'every resting ball should be asleep');
  assert.ok(pile.every((b) => b.vrot === 0), 'and none of them still spinning');

  // asleep means stepBall skips them, so no further impacts are reported
  for (const b of pile) stepBall(b, w, null, DT);
  assert.ok(pile.every((b) => !b.hit), 'a sleeping pile reports no impacts');
});

test('a sleeping ball wakes when something barges into it', () => {
  const w = world();
  const asleep = makeBall(null, 200, w.floor - 31, 31);
  asleep.asleep = true;

  const finger = makeBall(null, 200 - 40, w.floor - 31, 31);
  finger.pinned = true;
  finger.vx = 700;

  separate([finger, asleep]);
  assert.equal(asleep.asleep, false, 'a shove has to wake it');
});

test('a pinned ball moving into the pile passes on its speed', () => {
  const finger = makeBall(null, 100, 100, 31);
  const loose  = makeBall(null, 130, 100, 31);
  finger.pinned = true;
  finger.vx = 900;          // finger sweeping right through the pile

  separate([finger, loose]);

  assert.ok(loose.vx > 500, `expected a real shove, got vx=${loose.vx.toFixed(0)}`);
  assert.equal(finger.vx, 900, 'the held ball keeps following the finger');
});
