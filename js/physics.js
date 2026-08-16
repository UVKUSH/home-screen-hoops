import { TUNE } from './config.js';

const SUBSTEPS = 4;   // smaller physics slices = balls can't tunnel through the rim
const REST_SPEED = 26; // below this, a ball on the floor is considered asleep

export function createWorld() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    w, h,
    g: TUNE.gravity * h,       // px per second², downward
    gx: 0,                     // sideways gravity — set by the tilt sensor
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

  // Drag as "fraction of speed kept per SECOND", converted to this substep.
  // Multiplying by a flat constant each substep instead would make the game
  // play differently on a 120Hz phone than a 60Hz one — and the drag would be
  // heavy enough to throw off the aim assist's trajectory maths.
  const damp = Math.pow(TUNE.air, h);

  for (let i = 0; i < SUBSTEPS; i++) {
    const prevY = b.y;

    b.vy += world.g * h;
    b.vx += world.gx * h;
    b.vx *= damp;
    b.vy *= damp;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.rot += b.vrot * h;

    // side walls
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = -b.vx * TUNE.wallBounce;
      b.vrot = -b.vrot * 0.7;
    } else if (b.x + b.r > world.w) {
      b.x = world.w - b.r;
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
    b.vx -= (1 + TUNE.rimBounce) * vn * nx;
    b.vy -= (1 + TUNE.rimBounce) * vn * ny;
    b.vrot += -vn * 0.02;
  }
}

/**
 * Push overlapping balls apart. Only used while the 24 icons are tumbling
 * into a pile — during play there is never more than one ball moving.
 */
export function separate(balls) {
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
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;

      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      a.asleep = b.asleep = false;

      // swap the velocity along the line between their centres
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel >= 0) continue;
      const imp = -(1 + 0.3) * rel / 2;
      a.vx -= imp * nx; a.vy -= imp * ny;
      b.vx += imp * nx; b.vy += imp * ny;
    }
  }
}

export function render(b) {
  const x = b.x - b.r;
  const y = b.y - b.r;
  b.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${b.rot.toFixed(2)}rad)`;
}
