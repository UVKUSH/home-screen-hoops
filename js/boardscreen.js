import { HOME_SWIPE } from './config.js';
import { fetchTop } from './api.js';
import { renderRows } from './board.js';
import { rememberedName } from './scorecard.js';
import * as sound from './sound.js';

/**
 * Tap Reminders.
 *
 * The board used to be reachable only by finishing a game and submitting a
 * score, which meant the one screen people might actually want to come back for
 * was the hardest one to reach. Here it's an app.
 *
 * It sits above the home screen but below the home bar, so the bar stays put as
 * chrome and as the way out — the same swipe, and the same numbers, as quitting
 * a game. A real app would stop there; this also runs on desktops, where that
 * gesture is a click-drag nothing hints at, so there's a Done in the corner and
 * Esc for anyone who reaches for it.
 */
// Matches the .42s slide in the stylesheet. Kept as a number here because the
// screen has to be taken out of the tree after it has gone, and there is no
// event that reliably says so — see closeBoard.
const SLIDE_MS = 420;

let screen = null;
let open = false;
let hideTimer = null;

export function showBoard() {
  screen ??= build();
  open = true;
  clearTimeout(hideTimer);
  document.getElementById('home').setAttribute('inert', '');
  screen.hidden = false;
  // Flush layout so the transition has a start point to move from. A rAF would
  // read more naturally and it is what this was written as, but rAF does not
  // run in a backgrounded tab: the screen would come back from the tab switch
  // still sitting off the bottom of the window, with no way to get it up.
  void screen.offsetWidth;
  screen.classList.add('up');
  sound.star();
  load();
}

function closeBoard() {
  if (!open) return;
  open = false;
  screen.classList.remove('up');
  document.getElementById('home').removeAttribute('inert');
  // Out of the tree once it has slid away — hidden rather than merely
  // translated, so it stops being focusable and readable. Not on transitionend:
  // under prefers-reduced-motion there is no transition, so no event ever comes
  // and the screen would sit in the tree for good.
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (!open) screen.hidden = true; }, SLIDE_MS);
}

// ── the fetch ─────────────────────────────────────────────────
let inFlight = 0;

async function load() {
  const body = screen.querySelector('.board-body');
  const seq = ++inFlight;
  setState(body, 'loading');

  try {
    const { top } = await fetchTop();
    if (seq !== inFlight) return;        // a newer open already took over
    if (!top?.length) return setState(body, 'empty');
    renderRows(screen.querySelector('#board-list'), top, { name: rememberedName() });
    setState(body, 'rows');
  } catch (err) {
    if (seq !== inFlight) return;
    screen.querySelector('.board-err').textContent = err.message;
    setState(body, 'error');
  }
}

/** Exactly one of the four states is ever showing. */
function setState(body, which) {
  for (const el of body.children) el.hidden = el.dataset.state !== which;
}

// ── build ─────────────────────────────────────────────────────
function build() {
  const el = document.createElement('div');
  el.id = 'board-screen';
  el.hidden = true;
  el.innerHTML =
    `<header class="board-top">` +
      `<h1>Leaderboard</h1>` +
      `<button type="button" class="board-done" data-close>Done</button>` +
    `</header>` +
    `<p class="board-sub">Best 25, everywhere</p>` +
    `<div class="board-body">` +
      // four skeleton bars: enough to read as a list loading, few enough that
      // the real rows landing doesn't feel like the screen jumped
      `<div data-state="loading" class="board-skel">${'<i></i>'.repeat(4)}</div>` +
      `<ol id="board-list" class="board" data-state="rows" hidden></ol>` +
      `<p data-state="empty" class="board-note" hidden>No scores yet.<br>Be the first.</p>` +
      `<div data-state="error" hidden>` +
        `<p class="board-note board-err"></p>` +
        `<button type="button" class="board-retry" data-retry>Try again</button>` +
      `</div>` +
    `</div>`;

  el.querySelector('[data-close]').addEventListener('click', closeBoard);
  el.querySelector('[data-retry]').addEventListener('click', load);

  watchSwipe(el);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBoard(); });

  document.body.appendChild(el);
  return el;
}

/**
 * Swipe up from the bottom to leave, matching the game's exit.
 *
 * The board scrolls, so the gesture only arms in the bottom strip — starting a
 * drag anywhere else has to stay available for scrolling the list.
 */
function watchSwipe(el) {
  let from = null;

  el.addEventListener('pointerdown', (e) => {
    from = e.clientY > innerHeight - HOME_SWIPE.strip ? e.clientY : null;
  }, { passive: true });

  el.addEventListener('pointermove', (e) => {
    if (from !== null && from - e.clientY > HOME_SWIPE.pull) {
      from = null;
      closeBoard();
    }
  }, { passive: true });

  const drop = () => { from = null; };
  el.addEventListener('pointerup', drop, { passive: true });
  el.addEventListener('pointercancel', drop, { passive: true });
}
