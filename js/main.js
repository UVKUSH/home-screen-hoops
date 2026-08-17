import { buildHomeScreen } from './homescreen.js';
import { watchSpotlight } from './longpress.js';
import { createGame } from './game.js';
import { TUNE, HOME_SWIPE } from './config.js';
import { runSplash } from './splash.js';
import { wireInstallHelp, maybeShowInstall } from './install.js';
import { startAnalytics } from './analytics.js';

buildHomeScreen();
runSplash();
const game = createGame();
watchSpotlight((origin) => game.breakPhone(origin));

// open with ?debug to poke at it from the console
if (location.search.includes('debug')) window.hoops = game;

// ── input ─────────────────────────────────────────────────────
let exitFrom = null;

addEventListener('pointerdown', (e) => {
  if (e.target.closest('#scorecard, #install')) return;
  if (game.state !== 'play') return;

  // bottom edge = "put my phone back", everywhere else = shoot
  if (e.clientY > innerHeight - HOME_SWIPE.strip) {
    exitFrom = e.clientY;
    return;
  }
  game.grab(e);
}, { passive: true });

addEventListener('pointermove', (e) => {
  if (exitFrom !== null) {
    if (exitFrom - e.clientY > HOME_SWIPE.pull) { exitFrom = null; game.goHome(); }
    return;
  }
  game.moveDrag(e);
}, { passive: true });

const letGo = () => { exitFrom = null; game.release(); };
addEventListener('pointerup', letGo, { passive: true });
addEventListener('pointercancel', letGo, { passive: true });

wireInstallHelp();
// first visit only, and after the splash so the two don't collide
maybeShowInstall({ delay: TUNE.splashMs + 700 });

// no-op until a token is configured, and never on localhost
startAnalytics();

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
