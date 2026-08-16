import { TUNE, rankFor } from './config.js';
import { createWorld, stepBall, separate, render, timeToRim } from './physics.js';
import { createHoop } from './hoop.js';
import { toBalls, homeAgain } from './transform.js';
import { resetSpotlight } from './longpress.js';
import { createTilt } from './tilt.js';

// Where the loaded ball waits. Kept above the pile so the ball you're about to
// shoot is never buried in it, and pushed to the RIGHT so there's real diagonal
// distance to the hoop. Shooting from directly under the rim doesn't work: on
// the way up the ball passes through rim height right where the near post is,
// and clangs off it no matter how well you aim.
const LAUNCH_X   = 0.76;
const LAUNCH_Y   = 0.68;
const DRAG_LIMIT = 0.42;  // you can't drag the ball higher than this — no cheating
const SAMPLE_MS  = 80;    // flick speed is measured over the last 80ms only.
                          // people slow down before lifting a finger; using the
                          // whole gesture makes every shot feel weak.

export function createGame() {
  const hud   = document.getElementById('hud');
  const flash = document.getElementById('flash');
  const card  = document.getElementById('scorecard');
  const hint  = document.getElementById('hint');
  const tilt  = createTilt();

  let world = createWorld();
  let hoop  = null;
  let balls = [];

  let state = 'home';      // home | drop | play | over
  let dropT = 0;
  let score = 0;
  let shots = 0;
  let loaded = null;       // the ball waiting at the bottom
  let active = null;       // the ball in the air
  let shotT = 0;
  let drag = null;
  let tookAShot = false;   // the "flick up" nudge only shows until the first shot
  let total = 0;           // one shot per icon on the page you broke

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
    // take the ball sitting nearest the front of the pile
    const pool = balls.filter((b) => !b.shot && !b.gone);
    if (!pool.length || shots >= total) return finish();

    loaded = pool.reduce((a, b) => (b.y > a.y ? b : a));
    loaded.asleep = false;
    loaded.settling = true;
    loaded.el.classList.add('loaded');
    if (!tookAShot) hint.classList.add('show');
  }

  function launchPoint() {
    return { x: world.w * LAUNCH_X, y: world.h * LAUNCH_Y };
  }

  // ── shooting ────────────────────────────────────────────────
  function grab(e) {
    if (state !== 'play' || active || !loaded) return;
    drag = { samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
    loaded.settling = false;
    hint.classList.remove('show');
    moveDrag(e);
  }

  function moveDrag(e) {
    if (!drag || !loaded) return;
    loaded.x = clamp(e.clientX, loaded.r, world.w - loaded.r);
    loaded.y = clamp(e.clientY, world.h * DRAG_LIMIT, world.h - loaded.r);

    const now = performance.now();
    drag.samples.push({ t: now, x: e.clientX, y: e.clientY });
    while (drag.samples.length > 2 && now - drag.samples[0].t > SAMPLE_MS * 2) drag.samples.shift();
  }

  function release() {
    if (!drag || !loaded) return;
    const s = drag.samples;
    drag = null;

    // A real flick lands several move events and travels a visible distance.
    // A stray tap (or a mouse that jumps across the screen) does neither, and
    // shouldn't be allowed to burn a shot.
    const travel = Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y);
    if (s.length < 3 || travel < 20) {
      loaded.settling = true;
      if (!tookAShot) hint.classList.add('show');
      return;
    }

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
    if (speed < world.minSpeed || vy > 0) {
      loaded.settling = true;          // a nudge, not a shot — put it back
      if (!tookAShot) hint.classList.add('show');
      return;
    }
    if (speed > world.maxSpeed) {
      const k = world.maxSpeed / speed;
      vx *= k; vy *= k;
    }

    vx = assist(loaded, vx, vy);

    loaded.vx = vx;
    loaded.vy = vy;
    loaded.vrot = vx * 0.012;
    loaded.asleep = false;
    loaded.shot = true;
    loaded.el.classList.remove('loaded');

    active = loaded;
    loaded = null;
    shotT = 0;
    shots++;
    tookAShot = true;
    hint.classList.remove('show');
    updateHud();
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
      }
      separate(balls);
      balls.forEach(render);
      if (dropT * 1000 >= TUNE.dropMs) beginPlay();
      return;
    }

    if (state === 'play' || state === 'over') {
      hoop.update(dt, shots, world);

      // Leaning the phone drags everything sideways. The loose pile only gets
      // simulated when tilt is actually live, so on a desktop this costs nothing.
      world.gx = tilt.gx(world);
      if (tilt.live) {
        const loose = balls.filter((b) => !b.gone && b !== active && b !== loaded);
        for (const b of loose) {
          b.asleep = false;
          stepBall(b, world, null, dt);
        }
        separate(loose);
      }

      if (loaded && loaded.settling) {
        const p = launchPoint();
        loaded.x += (p.x - loaded.x) * Math.min(1, dt * 9);
        loaded.y += (p.y - loaded.y) * Math.min(1, dt * 9);
        loaded.rot *= 0.9;
      }
      if (loaded && hint.classList.contains('show')) {
        hint.style.top = `${(loaded.y - loaded.r - 44).toFixed(0)}px`;
        hint.style.left = `${loaded.x.toFixed(0)}px`;
      }

      if (active) {
        shotT += dt;
        const ev = stepBall(active, world, hoop, dt);
        if (ev === 'score') onScore();
        if (shotOver()) endShot();
      }

      balls.forEach(render);
    }
  }

  function shotOver() {
    if (!active) return false;
    if (active.y - active.r > world.h) return true;
    if (shotT > 4.5) return true;
    const settled = active.y + active.r >= world.floor - 2 && Math.abs(active.vy) < 30 && Math.abs(active.vx) < 40;
    return settled && shotT > 0.6;
  }

  function onScore() {
    score++;
    hoop.swish();
    navigator.vibrate?.(18);
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    hud.classList.remove('pop');  void hud.offsetWidth;  hud.classList.add('pop');
    updateHud();
  }

  function endShot() {
    const b = active;
    active = null;
    if (b.scored) {
      b.gone = true;
      b.el.style.transition = 'opacity .3s ease';
      b.el.style.opacity = '0';
    }
    if (shots >= total) finish();
    else loadNext();
  }

  function updateHud() {
    document.getElementById('hud-score').textContent = score;
    const left = Math.max(0, total - shots);
    document.getElementById('hud-shots').textContent = left === 1 ? '1 left' : `${left} left`;
  }

  function finish() {
    state = 'over';
    loaded = null;
    hint.classList.remove('show');
    tilt.hide();
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-total').textContent = `/ ${total}`;
    document.getElementById('final-rank').textContent = rankFor(score, total);
    card.classList.add('show');
  }

  // ── restart / exit ──────────────────────────────────────────
  function runItBack() {
    card.classList.remove('show');
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
    card.classList.remove('show');
    state = 'home';
    active = null;
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
    get world() { return world; },
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
