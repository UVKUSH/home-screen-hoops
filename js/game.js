import { TUNE, rankFor } from './config.js';
import { createWorld, stepBall, separate, settle, render, timeToRim } from './physics.js';
import { createHoop } from './hoop.js';
import { toBalls, homeAgain } from './transform.js';
import { resetSpotlight } from './longpress.js';
import { createTilt } from './tilt.js';
import { createScorecard } from './scorecard.js';
import * as sound from './sound.js';
import { ember, clearEmbers } from './fire.js';

// Where the loaded ball waits. Kept above the pile so the ball you're about to
// shoot is never buried in it, and pushed to the RIGHT so there's real diagonal
// distance to the hoop. Shooting from directly under the rim doesn't work: on
// the way up the ball passes through rim height right where the near post is,
// and clangs off it no matter how well you aim.
const LAUNCH_X   = 0.76;
const LAUNCH_Y   = 0.68;
const DRAG_LIMIT = 0.42;  // you can't drag the ball higher than this — no cheating
// impact speed -> 0..1 loudness. A ball dropped from the top of the screen
// lands at roughly 2 screen-heights per second, which is the ceiling.
const LOUDEST    = 2.0;
const SAMPLE_MS  = 80;    // flick speed is measured over the last 80ms only.
                          // people slow down before lifting a finger; using the
                          // whole gesture makes every shot feel weak.

export function createGame() {
  const hud   = document.getElementById('hud');
  const flash = document.getElementById('flash');
  const scorecard = createScorecard({
    onAgain: () => runItBack(),
    onHome:  () => goHome(),
  });
  const hint  = document.getElementById('hint');
  const tilt  = createTilt();

  let world = createWorld();
  let hoop  = null;
  let balls = [];

  let state = 'home';      // home | drop | play | over
  let dropT = 0;
  let score = 0;
  let shots = 0;
  let loaded = null;       // the ball parked at the launch corner, ready to go
  let held = null;         // the ball actually under the finger — any ball you grab
  let flying = [];         // every ball currently in the air — you can shoot
                           // again without waiting for the last one to land
  let drag = null;
  let tookAShot = false;   // the "flick up" nudge only shows until the first shot
  let total = 0;           // one shot per icon on the page you broke
  let streak = 0;          // buckets in a row — hit enough and the ball lights up
  let misses = 0;          // misses in a row; only a run of them puts the fire out
  let lit = false;         // currently on fire

  // ── the gag fires ───────────────────────────────────────────
  function breakPhone(origin) {
    if (state !== 'home') return;
    state = 'drop';
    dropT = 0;
    score = 0;
    shots = 0;

    world = createWorld();
    balls = toBalls(world, origin);
    total = balls.length;          // one shot per icon that just turned into a ball
    sound.thump();
    document.body.classList.add('morphing');
    document.getElementById('court').removeAttribute('inert');
    document.getElementById('home').setAttribute('inert', '');

    if (!hoop) hoop = createHoop(world, balls[0].r);
    hoop.draw();

    setTimeout(() => {
      document.body.classList.add('playing');
      document.body.classList.add('hoop-in');
    }, 260);

    updateHud();
  }

  // ── the pile settles, the match starts ──────────────────────
  function beginPlay() {
    state = 'play';
    for (const b of balls) { b.asleep = true; b.vx = b.vy = 0; }
    tilt.offer();
    loadNext();
  }

  function loadNext() {
    const pool = balls.filter((b) => !b.shot && !b.gone);
    if (!pool.length || shots >= total) return finish();
    if (loaded) return;            // one is already parked and waiting

    // take the ball sitting nearest the front of the pile
    loaded = pool.reduce((a, b) => (b.y > a.y ? b : a));
    loaded.asleep = false;
    loaded.settling = true;
    refreshRings();
    if (!tookAShot) hint.classList.add('show');
  }

  /**
   * Exactly one ball wears the ring: the one under your finger, or the parked
   * one when you aren't holding anything. Recomputed rather than toggled, so
   * it can't drift out of step.
   */
  function refreshRings() {
    for (const b of balls) {
      b.el.classList.toggle('loaded', held ? b === held : b === loaded);
    }
  }

  /**
   * Bring the next ball to the corner while the current shot is still in the
   * air, so it's waiting the instant the shot resolves rather than starting to
   * glide then. Never finishes the game — that's endShot's job, or the
   * scorecard would appear mid-flight on the last shot.
   */
  function preload() {
    if (loaded || shots >= total) return;
    const pool = balls.filter((b) => !b.shot && !b.gone);
    if (!pool.length) return;

    loaded = pool.reduce((a, b) => (b.y > a.y ? b : a));
    loaded.asleep = false;
    loaded.settling = true;
    refreshRings();
  }

  function launchPoint() {
    return { x: world.w * LAUNCH_X, y: world.h * LAUNCH_Y };
  }

  // ── shooting ────────────────────────────────────────────────
  /** Whichever ball you actually put your finger on, if any. */
  function ballAt(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const b of balls) {
      if (b.shot || b.gone) continue;
      const dist = Math.hypot(b.x - x, b.y - y);
      // a little generous — fingers are bigger than the pixel they report
      if (dist < b.r * 1.35 && dist < bestDist) { best = b; bestDist = dist; }
    }
    return best;
  }

  function grab(e) {
    if (state !== 'play') return;

    // grab what you touched; touching nothing falls back to the parked ball so
    // a lazy flick from anywhere still works
    const pick = ballAt(e.clientX, e.clientY) ?? loaded;
    if (!pick) return;

    held = pick;
    held.pinned = true;
    held.asleep = false;
    held.settling = false;
    held.settling = false;
    refreshRings();

    drag = { samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }], last: performance.now() };
    hint.classList.remove('show');
    moveDrag(e);
  }

  function moveDrag(e) {
    if (!drag || !held) return;

    const x = clamp(e.clientX, held.r, world.w - held.r);
    const y = clamp(e.clientY, world.h * DRAG_LIMIT, world.h - held.r);

    const now = performance.now();
    // The finger sets the position outright, but the pile needs a velocity to
    // bounce off — so derive one from how fast the finger is actually moving.
    const step = Math.max((now - drag.last) / 1000, 0.001);
    held.vx = (x - held.x) / step;
    held.vy = (y - held.y) / step;
    held.x = x;
    held.y = y;
    drag.last = now;

    drag.samples.push({ t: now, x: e.clientX, y: e.clientY });
    while (drag.samples.length > 2 && now - drag.samples[0].t > SAMPLE_MS * 2) drag.samples.shift();
  }

  function release() {
    if (!drag || !held) return;
    const s = drag.samples;
    const ball = held;
    drag = null;
    held = null;
    ball.pinned = false;

    /** Put it back without spending a shot. */
    const putBack = () => {
      // the parked ball returns to the corner; one you dug out of the pile
      // just drops back into it
      if (ball === loaded) ball.settling = true;
      else ball.asleep = false;
      refreshRings();
      if (!tookAShot) hint.classList.add('show');
    };

    // A real flick lands several move events and travels a visible distance.
    // A stray tap (or a mouse that jumps across the screen) does neither, and
    // shouldn't be allowed to burn a shot.
    const travel = Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y);
    if (s.length < 3 || travel < 20) return putBack();

    const last = s[s.length - 1];
    let first = s[0];
    for (let i = s.length - 1; i >= 0; i--) {
      first = s[i];
      if (last.t - s[i].t >= SAMPLE_MS) break;
    }

    const dt = Math.max((last.t - first.t) / 1000, 0.016);
    let vx = ((last.x - first.x) / dt) * TUNE.power;
    let vy = ((last.y - first.y) / dt) * TUNE.power;

    const speed = Math.hypot(vx, vy);
    if (speed < world.minSpeed || vy > 0) return putBack();   // a nudge, not a shot
    if (speed > world.maxSpeed) {
      const k = world.maxSpeed / speed;
      vx *= k; vy *= k;
    }

    ball.vx = assist(ball, vx, vy);
    ball.vy = vy;
    ball.vrot = ball.vx * 0.012;
    ball.asleep = false;
    ball.shot = true;

    sound.whoosh(speed / (world.h * LOUDEST));
    if (lit) ball.el.classList.add('fire');

    ball.flightT = 0;
    flying.push(ball);
    if (ball === loaded) loaded = null;     // the corner is free again
    refreshRings();
    shots++;
    tookAShot = true;
    hint.classList.remove('show');
    updateHud();
    preload();          // the next ball moves up while this one is still flying
  }

  /**
   * Nudge the sideways speed toward whatever would put the ball over the rim
   * at the moment it reaches rim height. Honest arc, slightly forgiving aim.
   */
  function assist(b, vx, vy) {
    if (TUNE.aimAssist <= 0) return vx;
    const t = timeToRim(vy, b.y - hoop.y, world.g);
    if (t === null) return vx;                      // shot never reaches the rim
    const ideal = (hoop.x - b.x) / t;
    return vx + (ideal - vx) * TUNE.aimAssist;
  }

  // ── per-frame ───────────────────────────────────────────────
  function update(dt) {
    if (state === 'home') return;

    if (state === 'drop') {
      dropT += dt;
      for (const b of balls) {
        if (b.hold > 0) { b.hold -= dt; continue; }
        stepBall(b, world, null, dt);
        playHit(b);
      }
      separate(balls, 4, world);
      balls.forEach(render);
      if (dropT * 1000 >= TUNE.dropMs) beginPlay();
      return;
    }

    if (state === 'play' || state === 'over') {
      hoop.update(dt, shots, world);

      // Gravity follows the phone: lean to roll the pile, lay it flat and the
      // balls go weightless, turn it over and they fall up off the top.
      world.gx = tilt.gx(world);
      world.gy = tilt.gy(world);

      // The pile is simulated the whole time now, not just under tilt — a ball
      // you're dragging has to be able to barge the others out of the way.
      // A ball gliding back to the launch corner is driven by the lerp below,
      // so it must not ALSO be falling — simulating and animating the same ball
      // let its velocity run away to hundreds of px/s while it looked calm, and
      // it battered the pile every frame.
      const gliding = loaded && loaded !== held && loaded.settling;
      const loose = balls.filter((b) => (
        !b.gone && b !== held && !flying.includes(b) && b !== (gliding ? loaded : null)
      ));
      for (const b of loose) {
        if (tilt.leaning) b.asleep = false;
        stepBall(b, world, null, dt);
        playHit(b);
      }

      // The held ball joins the collision pass but is never displaced by it.
      // A shot only joins once it's properly airborne, so it can't clip its way
      // out of the corner on launch — but it will scatter the pile on landing.
      const bodies = [...loose];
      if (held) bodies.unshift(held);
      if (gliding) bodies.unshift(loaded);
      for (const b of flying) if (b.flightT > 0.25) bodies.push(b);
      separate(bodies, 4, world);
      // never settle mid-lean, or sleeping wipes the speed the tilt is building
      settle(loose, dt, tilt.leaning);

      if (gliding) {
        loaded.pinned = true;      // it shoves the pile aside, nothing shoves it
        loaded.vx = 0;
        loaded.vy = 0;
        const p = launchPoint();
        loaded.x += (p.x - loaded.x) * Math.min(1, dt * 16);
        loaded.y += (p.y - loaded.y) * Math.min(1, dt * 16);
        loaded.rot *= 0.9;
        // An eased approach never actually arrives, so it would keep nudging
        // (and re-rendering) forever. Snap and sleep once it's close enough.
        if (Math.hypot(p.x - loaded.x, p.y - loaded.y) < 0.5) {
          loaded.x = p.x;
          loaded.y = p.y;
          loaded.rot = 0;
          loaded.settling = false;
          loaded.pinned = false;
          loaded.asleep = true;
        }
      }
      if (loaded && loaded !== held && hint.classList.contains('show')) {
        hint.style.top = `${(loaded.y - loaded.r - 44).toFixed(0)}px`;
        hint.style.left = `${loaded.x.toFixed(0)}px`;
      }

      for (const b of flying) {
        b.flightT += dt;
        const ev = stepBall(b, world, hoop, dt);
        playHit(b);
        if (b.el.classList.contains('fire')) ember(b.x, b.y, b.r);
        if (ev === 'score') onScore();
      }
      for (const b of [...flying]) if (shotOver(b)) endShot(b);

      balls.forEach(render);
    }
  }

  /** Turn whatever the ball just hit into a noise. */
  /** Full reset, for leaving or restarting a game. */
  function coolDown() {
    putOut();
    clearEmbers();
  }

  function putOut() {
    lit = false;
    streak = 0;
    misses = 0;
    document.body.classList.remove('on-fire');
    for (const b of balls) b.el.classList.remove('fire');
  }

  function catchFire() {
    lit = true;
    misses = 0;
    document.body.classList.add('on-fire');
    sound.ignite();
    navigator.vibrate?.([14, 30, 14, 30, 40]);
    for (const b of flying) b.el.classList.add('fire');
  }

  function playHit(b) {
    if (b.hit) sound.impact(b.hit.type, b.hit.speed / (world.h * LOUDEST));
  }

  /**
   * A shot is over when its OUTCOME is settled, not when the ball finally stops
   * moving. Waiting for it to finish bouncing around the floor was costing five
   * seconds between shots. The spent ball carries on rolling as scenery — it's
   * already marked shot, so it can't be picked up again.
   */
  function shotOver(b) {
    if (b.scored) return b.flightT > 0.3;              // it's in — get on with it
    if (b.y - b.r > world.h) return true;              // off the bottom
    // Falling and completely below the rim: it cannot go in from here.
    if (b.vy > 0 && b.y - b.r > hoop.y + 30) return true;
    return b.flightT > 2.5;                            // backstop
  }

  function onScore() {
    score++;
    misses = 0;
    streak++;
    if (streak === TUNE.fireAt) catchFire();
    sound.swish();
    hoop.swish();
    navigator.vibrate?.(18);
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    hud.classList.remove('pop');  void hud.offsetWidth;  hud.classList.add('pop');
    updateHud();
  }

  function endShot(b) {
    flying = flying.filter((x) => x !== b);
    b.el.classList.remove('fire');
    if (!b.scored) {
      misses += 1;
      // Once you're lit you stay lit. One rim-out shouldn't end a hot streak —
      // it takes a proper run of misses to put it out.
      if (lit) {
        if (misses >= TUNE.coolAfter) putOut();
      } else {
        streak = 0;
      }
    }
    if (b.scored) {
      b.gone = true;
      b.el.style.transition = 'opacity .3s ease';
      b.el.style.opacity = '0';
    }
    // only wrap up once every shot has actually landed
    if (shots >= total && flying.length === 0) finish();
    else preload();
  }

  function updateHud() {
    document.getElementById('hud-score').textContent = score;
    const left = Math.max(0, total - shots);
    document.getElementById('hud-shots').textContent = left === 1 ? '1 left' : `${left} left`;
  }

  function finish() {
    state = 'over';
    flying = [];
    coolDown();
    if (held) held.pinned = false;
    held = null;
    loaded = null;
    hint.classList.remove('show');
    tilt.hide();
    scorecard.open(score, total, rankFor(score, total));
  }

  // ── restart / exit ──────────────────────────────────────────
  function runItBack() {
    scorecard.close();
    if (held) held.pinned = false;
    held = null;
    loaded = null;
    flying = [];
    coolDown();
    score = 0;
    shots = 0;
    dropT = 0;
    for (const b of balls) {
      b.el.style.transition = '';
      b.el.style.opacity = '';
      b.shot = false;
      b.scored = false;
      b.gone = false;
      b.asleep = false;
      b.settling = false;
      b.pinned = false;
      b.el.classList.remove('loaded');
      b.x = world.w * (0.15 + Math.random() * 0.7);
      b.y = -b.r - Math.random() * world.h * 0.5;
      b.vx = (Math.random() - 0.5) * world.w * 0.3;
      b.vy = 0;
      b.hold = 0;
    }
    updateHud();
    state = 'drop';
  }

  async function goHome() {
    if (state === 'home') return;
    scorecard.close();
    state = 'home';
    flying = [];
    coolDown();
    if (held) held.pinned = false;
    held = null;
    loaded = null;
    drag = null;
    document.body.classList.remove('playing', 'hoop-in');
    hint.classList.remove('show');
    tilt.hide();
    for (const b of balls) { b.el.style.opacity = ''; b.el.classList.remove('loaded'); }
    await homeAgain(balls);
    balls = [];
    document.body.classList.remove('morphing');
    document.getElementById('court').setAttribute('inert', '');
    document.getElementById('home').removeAttribute('inert');
    resetSpotlight();
  }

  // Gravity and the speed caps are baked into the world when it's built, so a
  // change from the dials panel has to be folded in rather than read per frame.
  addEventListener('dials-changed', () => {
    world.g = TUNE.gravity * world.h;
    world.maxSpeed = TUNE.maxSpeed * world.h;
    world.minSpeed = TUNE.minSpeed * world.h;
  });

  function resize() {
    const w = createWorld();
    world = w;
    if (hoop) { hoop.y = Math.round(w.h * 0.30); hoop.draw(); }
  }

  return {
    breakPhone, grab, moveDrag, release, update, runItBack, goHome, resize, tilt,
    get state() { return state; },
    get score() { return score; },
    get shots() { return shots; },
    get hoop() { return hoop; },
    get balls() { return balls; },
    get streakState() { return { streak, misses, lit }; },
    get world() { return world; },
    get audioReady() { return sound.ready(); },
    /** Jump straight to the scorecard. Only reachable via ?debug. */
    forceFinish(fakeScore = score) { score = fakeScore; finish(); },
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
