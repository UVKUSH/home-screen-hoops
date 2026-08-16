import { TUNE } from './config.js';

const SUBSTEPS = 4;   // smaller physics slices = balls can't tunnel through the rim
const REST_SPEED = 26; // below this, a ball on the floor is considered asleep

// Resting contacts. Without these a stacked pile buzzes forever: gravity presses
// the balls together, the separation pushes them apart, and the bounce does it
// all again next frame — jitter, endless spin, and a stream of tiny impact
// sounds from a pile that looks perfectly still.
const SLOP        = 0.6;  // overlap we simply tolerate
const DEAD_BOUNCE = 45;   // approach speed below which a contact doesn't bounce
const SLEEP_DRIFT = 0.35; // px per frame under which a ball counts as parked
const SLEEP_TIME  = 0.3;  // how long it must stay stopped before it sleeps
const GRIP        = 0.45; // friction between touching balls, 0..1 per pass. Without
                          // it a heap of near-frictionless spheres creeps down
                          // its own slope forever and never comes to rest

export function createWorld() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    w, h,
    g: TUNE.gravity * h,       // px per second², the nominal strength
    gx: 0,                     // sideways gravity — steered by tilt
    gy: TUNE.gravity * h,      // vertical gravity — tilt can weaken or invert
                               // this, while g stays put for the aim assist
    floor: h - 4,              // balls rest just off the bottom edge
    maxSpeed: TUNE.maxSpeed * h,
    minSpeed: TUNE.minSpeed * h,
  };
}

export function makeBall(el, x, y, r) {
  return { el, x, y, vx: 0, vy: 0, r, rot: 0, vrot: 0, asleep: false, scored: false, gone: false };
}

/**
 * Advance one ball. Returns 'score' on the frame it drops through the rim,
 * 'gone' once it has left the screen, otherwise null.
 *
 * `hoop` may be null (during the icon drop, before the hoop arrives).
 */
export function stepBall(b, world, hoop, dt) {
  if (b.asleep) return null;
  let event = null;
  const h = dt / SUBSTEPS;

  // Impacts are recorded on the ball rather than played from here, so this
  // module stays pure — it has to run in Node for the tests, where there is
  // no audio at all. The caller reads b.hit after stepping.
  b.hit = null;

  // Drag as "fraction of speed kept per SECOND", converted to this substep.
  // Multiplying by a flat constant each substep instead would make the game
  // play differently on a 120Hz phone than a 60Hz one — and the drag would be
  // heavy enough to throw off the aim assist's trajectory maths.
  const damp = Math.pow(TUNE.air, h);

  for (let i = 0; i < SUBSTEPS; i++) {
    const prevY = b.y;

    b.vy += (world.gy ?? world.g) * h;
    b.vx += world.gx * h;
    b.vx *= damp;
    b.vy *= damp;
    b.vrot *= damp;        // otherwise a ball spins at the same rate forever
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.rot += b.vrot * h;

    // side walls. The speed check matters: a ball resting against an edge is in
    // contact every single frame, and without it that reports an impact 60
    // times a second forever — the floor has always had this guard, the walls
    // did not.
    if (b.x - b.r < 0) {
      b.x = b.r;
      if (Math.abs(b.vx) > REST_SPEED) noteHit(b, 'wall', Math.abs(b.vx));
      b.vx = -b.vx * TUNE.wallBounce;
      b.vrot = -b.vrot * 0.7;
    } else if (b.x + b.r > world.w) {
      b.x = world.w - b.r;
      if (Math.abs(b.vx) > REST_SPEED) noteHit(b, 'wall', Math.abs(b.vx));
      b.vx = -b.vx * TUNE.wallBounce;
      b.vrot = -b.vrot * 0.7;
    }

    if (hoop && !b.scored) {
      // The rim is two posts. Hit either one and you clang out.
      hitPost(b, hoop.x - hoop.rimHalf, hoop.y, hoop.postR);
      hitPost(b, hoop.x + hoop.rimHalf, hoop.y, hoop.postR);

      // A bucket: centre crossed the rim plane, heading DOWN, inside the posts.
      // The downward check is what stops a ball rising through the net counting.
      const crossed = prevY <= hoop.y && b.y > hoop.y;
      if (crossed && b.vy > 0 && Math.abs(b.x - hoop.x) < hoop.rimHalf) {
        b.scored = true;
        event = 'score';
      }
    }

    // floor
    if (b.y + b.r > world.floor) {
      b.y = world.floor - b.r;

      if (b.vy > REST_SPEED) {
        noteHit(b, 'floor', b.vy);
        b.vy = -b.vy * TUNE.floorBounce;  // a real bounce
        b.vx *= 0.9;                      // scrub a little speed on impact
      } else {
        b.vy = 0;                         // resting on the floor
      }

      // Rolling friction as a constant deceleration scaled by the substep, so
      // it doesn't change with frame rate. Multiplying vx by a constant each
      // substep (the obvious version) kills the roll ~240x a second, which
      // means tilting the phone can never get a resting ball moving.
      const fr = TUNE.roll * world.g * h;
      if (b.vx > fr) b.vx -= fr;
      else if (b.vx < -fr) b.vx += fr;
      else b.vx = 0;

      b.vrot = b.vx * 0.06;
    }
  }

  // once it's off the bottom or far out to the side, retire it
  if (b.y - b.r > world.h + 200) event = 'gone';
  return event;
}

/**
 * How long until a ball launched with vertical speed `vy` (negative = up) from
 * `dy` px BELOW the rim falls back down through rim height.
 *
 * Solving ½g·t² + vy·t + dy = 0. Two things are easy to get wrong here:
 * the discriminant is vy² − 2g·dy (not +), and the answer is the LARGER root —
 * the smaller one is the moment the ball passes rim height on the way *up*,
 * which is not where anybody is trying to score.
 *
 * Returns null if the shot never reaches the rim at all.
 */
export function timeToRim(vy, dy, g) {
  const disc = vy * vy - 2 * g * dy;
  if (disc <= 0) return null;
  const t = (-vy + Math.sqrt(disc)) / g;
  return t > 0.05 ? t : null;
}

function hitPost(b, px, py, postR) {
  const dx = b.x - px;
  const dy = b.y - py;
  const min = b.r + postR;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return;

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  b.x = px + nx * min;
  b.y = py + ny * min;

  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    noteHit(b, 'rim', -vn);
    b.vx -= (1 + TUNE.rimBounce) * vn * nx;
    b.vy -= (1 + TUNE.rimBounce) * vn * ny;
    b.vrot += -vn * 0.02;
  }
}

/** Several substeps can collide; only the hardest one is worth hearing. */
function noteHit(b, type, speed) {
  if (!b.hit || speed > b.hit.speed) b.hit = { type, speed };
}

/**
 * Push overlapping balls apart and resolve the bounce between them. Runs over
 * the whole pile every frame, so resting contacts have to be handled properly
 * or two dozen balls sitting still will jitter, spin and click forever.
 */
export function separate(balls, iterations = 1, bounds = null) {
  // A single pass can't resolve a stack: fixing the bottom pair re-overlaps the
  // pair above it. Without a few passes the pile stays permanently compressed
  // and keeps squeezing balls out, which reads as the pile never settling.
  for (let pass = 0; pass < iterations; pass++) {
    solve(balls);
    // Keeping the solver inside the walls matters more than it looks. A pile
    // this wide has nowhere to spread, so separation shoves balls through the
    // edges; stepBall then sees them outside, reflects them, and hands back
    // MORE speed than they arrived with. That feedback loop was pumping the
    // pile to hundreds of px/s and it never had a chance to settle.
    if (bounds) for (const b of balls) confine(b, bounds);
  }
}

/**
 * Hold a ball inside the world — and kill the speed it was carrying into the
 * edge. Clamping position alone leaves the ball pinned at exactly the boundary,
 * where stepBall's floor test (a strict >) never fires again, so gravity piles
 * into vy unopposed: the pile looks frozen while every ball claims to be
 * falling at 100px/s, and nothing is ever still enough to fall asleep.
 */
function confine(b, bounds) {
  if (b.x < b.r) {
    b.x = b.r;
    if (b.vx < 0) b.vx = 0;
  } else if (b.x > bounds.w - b.r) {
    b.x = bounds.w - b.r;
    if (b.vx > 0) b.vx = 0;
  }
  if (b.y > bounds.floor - b.r) {
    b.y = bounds.floor - b.r;
    if (b.vy > 0) b.vy = 0;
  }
}

function solve(balls) {
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.gone) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (b.gone) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;

      const d = Math.sqrt(d2);
      const overlap = min - d;
      const nx = dx / d;
      const ny = dy / d;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;

      // A real collision, or a shove from a pinned ball (one the finger is
      // dragging, or one gliding back to the launch corner). Anything gentler
      // is a resting contact: it must not wake a sleeping ball or bounce.
      const hard = -rel > DEAD_BOUNCE || a.pinned || b.pinned;
      if (hard) a.asleep = b.asleep = false;

      // Position is corrected only past the slop, and eased rather than
      // snapped, so a stack doesn't overshoot and rebound every frame.
      if (overlap > SLOP) {
        const gap = (overlap - SLOP) * 0.8;
        // A pinned ball is immovable: it does the shoving and never gets
        // shoved. Otherwise dragging through the pile would push your own ball
        // off your finger.
        if (a.pinned) {
          b.x += nx * gap; b.y += ny * gap;
        } else if (b.pinned) {
          a.x -= nx * gap; a.y -= ny * gap;
        } else {
          a.x -= nx * gap / 2; a.y -= ny * gap / 2;
          b.x += nx * gap / 2; b.y += ny * gap / 2;
        }
      }

      // Velocity is ALWAYS resolved, even for a shallow overlap. Skipping it
      // there was the bug: a resting ball pocketed a frame of gravity over and
      // over until it had sunk far enough to bounce, so the pile breathed
      // instead of settling.
      if (rel >= 0) continue;
      const bounce = hard ? 0.3 : 0;   // a resting contact just cancels

      if (a.pinned) {
        const imp = -(1 + bounce) * rel;      // as if the pinned ball weighed a tonne
        b.vx += imp * nx; b.vy += imp * ny;
      } else if (b.pinned) {
        const imp = -(1 + bounce) * rel;
        a.vx -= imp * nx; a.vy -= imp * ny;
      } else {
        const imp = -(1 + bounce) * rel / 2;
        a.vx -= imp * nx; a.vy -= imp * ny;
        b.vx += imp * nx; b.vy += imp * ny;
      }

      // Friction along the contact. Cancelling only the head-on component
      // leaves the balls free to slide across each other, so gravity keeps
      // feeding sideways motion and the pile creeps like sand — never resting,
      // never sleeping, endlessly spinning and clicking. This is what lets a
      // heap of balls actually lock up.
      const tx = -ny;
      const ty = nx;
      const slide = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
      if (slide !== 0) {
        if (a.pinned) {
          b.vx -= slide * GRIP * tx; b.vy -= slide * GRIP * ty;
        } else if (b.pinned) {
          a.vx += slide * GRIP * tx; a.vy += slide * GRIP * ty;
        } else {
          const half = (slide * GRIP) / 2;
          a.vx += half * tx; a.vy += half * ty;
          b.vx -= half * tx; b.vy -= half * ty;
        }
      }
    }
  }
}

/**
 * Park balls that have genuinely stopped. Must run AFTER separate().
 *
 * Judged on how far the ball actually MOVED, not on its velocity. A ball
 * resting on one that's anchored to the floor keeps a stubborn phantom vy —
 * the equal-mass impulse hands half the correction to a neighbour that can't
 * use it — so by velocity it looks busy while sitting perfectly still. What
 * matters, for both the look and the noise, is whether it went anywhere.
 *
 * A sleeping ball is skipped by stepBall entirely, which is what stops a
 * settled pile from creeping, spinning and clicking away to itself.
 */
export function settle(list, dt, suspended = false) {
  // Sleeping zeroes velocity. While the phone is tilted that fights the lean —
  // the ball builds a little speed each frame and has it wiped before it can
  // travel far enough to count as moving, so gentle tilts do almost nothing.
  if (suspended) return;

  for (const b of list) {
    if (b.asleep || b.pinned) continue;

    const moved = Math.hypot(b.x - (b.lastX ?? b.x), b.y - (b.lastY ?? b.y));
    b.lastX = b.x;
    b.lastY = b.y;

    b.still = moved < SLEEP_DRIFT ? (b.still ?? 0) + dt : 0;
    if (b.still > SLEEP_TIME) {
      b.asleep = true;
      b.vx = 0;
      b.vy = 0;
      b.vrot = 0;
      b.still = 0;
    }
  }
}

export function render(b) {
  const x = b.x - b.r;
  const y = b.y - b.r;
  b.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${b.rot.toFixed(2)}rad)`;
}
