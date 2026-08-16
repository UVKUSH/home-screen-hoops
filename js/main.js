import { buildHomeScreen } from './homescreen.js';
import { watchSpotlight } from './longpress.js';
import { createGame } from './game.js';

const EXIT_STRIP = 26; // bottom edge zone reserved for the iOS-style home swipe
const EXIT_PULL  = 55; // how far up you drag it to bail out

buildHomeScreen();
const game = createGame();
watchSpotlight((origin) => game.breakPhone(origin));

// open with ?debug to poke at it from the console
if (location.search.includes('debug')) window.hoops = game;

// ── input ─────────────────────────────────────────────────────
let exitFrom = null;

addEventListener('pointerdown', (e) => {
  if (e.target.closest('#scorecard')) return;
  if (game.state !== 'play') return;

  // bottom edge = "put my phone back", everywhere else = shoot
  if (e.clientY > innerHeight - EXIT_STRIP) {
    exitFrom = e.clientY;
    return;
  }
  game.grab(e);
}, { passive: true });

addEventListener('pointermove', (e) => {
  if (exitFrom !== null) {
    if (exitFrom - e.clientY > EXIT_PULL) { exitFrom = null; game.goHome(); }
    return;
  }
  game.moveDrag(e);
}, { passive: true });

const letGo = () => { exitFrom = null; game.release(); };
addEventListener('pointerup', letGo, { passive: true });
addEventListener('pointercancel', letGo, { passive: true });

document.getElementById('again').addEventListener('click', () => game.runItBack());
document.getElementById('quit').addEventListener('click', () => game.goHome());

// stop Safari's own gestures from stealing the show
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('gesturestart', (e) => e.preventDefault());
addEventListener('dblclick', (e) => e.preventDefault());
addEventListener('resize', () => game.resize());

// ── loop ──────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30); // never let a hitch teleport a ball
  last = now;
  game.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
