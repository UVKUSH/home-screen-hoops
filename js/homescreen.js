import { PAGES, DOCK } from './apps.js';
import { COLS, ROWS, INDEX } from './sprite.js';

// Basketball seams, drawn over the icon once it goes round.
// viewBox is 0-100 so it scales to whatever the icon size is.
const SEAMS = `
<svg viewBox="0 0 100 100" fill="none" stroke="#111" stroke-width="3.4" stroke-linecap="round">
  <circle cx="50" cy="50" r="48.3" stroke-width="3.4"/>
  <path d="M50 1.7V98.3"/>
  <path d="M1.7 50H98.3"/>
  <path d="M15 10.5C33 30 33 70 15 89.5"/>
  <path d="M85 10.5C67 30 67 70 85 89.5"/>
</svg>`;

const SWIPE = 45;   // px of horizontal drag before the page flips

let page = 0;
let track;

/** Which cell of assets/sprite.webp holds this icon, as a background-position. */
function spritePos(id) {
  const n = INDEX[id];
  if (n === undefined) return '0% 0%';
  const col = n % COLS;
  const row = Math.floor(n / COLS);
  // with background-size set to COLS x ROWS, 100% means "last cell"
  const x = COLS > 1 ? (col / (COLS - 1)) * 100 : 0;
  const y = ROWS > 1 ? (row / (ROWS - 1)) * 100 : 0;
  return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
}

function makeIcon(app) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'app';
  el.dataset.id = app.id;
  el.innerHTML =
    `<span class="art" style="background-position:${spritePos(app.id)}">` +
      `<span class="seams">${SEAMS}</span>` +
    `</span>` +
    `<span class="name">${app.name}</span>`;

  // Nothing actually opens — just a little "nope" wobble so people keep poking.
  el.addEventListener('click', () => {
    if (document.body.classList.contains('playing')) return;
    el.classList.remove('nope');
    void el.offsetWidth;        // restart the animation
    el.classList.add('nope');
  });
  return el;
}

export function buildHomeScreen() {
  // one place to keep the sprite grid in sync with the generated index
  document.documentElement.style.setProperty('--sprite-size', `${COLS * 100}% ${ROWS * 100}%`);

  track = document.getElementById('track');
  const dots = document.getElementById('dots');
  const dock = document.getElementById('dock-icons');

  PAGES.forEach((apps, i) => {
    const p = document.createElement('div');
    p.className = 'page';
    p.dataset.page = i;
    apps.forEach((a) => p.appendChild(makeIcon(a)));
    track.appendChild(p);

    const dot = document.createElement('i');
    if (i === 0) dot.className = 'on';
    dots.appendChild(dot);
  });

  DOCK.forEach((a) => dock.appendChild(makeIcon(a)));

  watchSwipe();
  startClock();
}

// ── paging ────────────────────────────────────────────────────
function pageWidth() {
  return document.getElementById('pages').clientWidth;
}

function setPage(i, dragPx = 0, animate = true) {
  page = Math.max(0, Math.min(PAGES.length - 1, i));
  track.style.transition = animate ? '' : 'none';
  track.style.transform = `translate3d(${-page * pageWidth() + dragPx}px, 0, 0)`;
  [...document.getElementById('dots').children].forEach((d, n) => {
    d.className = n === page ? 'on' : '';
  });
}

function watchSwipe() {
  const home = document.getElementById('home');
  let from = null;

  home.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('playing')) return;
    from = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  home.addEventListener('pointermove', (e) => {
    if (!from) return;
    const dx = e.clientX - from.x;
    // ignore mostly-vertical drags so a scroll-ish gesture doesn't flip pages
    if (Math.abs(dx) < Math.abs(e.clientY - from.y)) return;
    // rubber-band at the two ends, the way iOS does
    const atEnd = (dx > 0 && page === 0) || (dx < 0 && page === PAGES.length - 1);
    setPage(page, atEnd ? dx * 0.32 : dx, false);
  }, { passive: true });

  const end = (e) => {
    if (!from) return;
    const dx = e.clientX - from.x;
    from = null;
    if (dx <= -SWIPE) setPage(page + 1);
    else if (dx >= SWIPE) setPage(page - 1);
    else setPage(page);
  };
  home.addEventListener('pointerup', end, { passive: true });
  home.addEventListener('pointercancel', () => { from = null; setPage(page); }, { passive: true });

  addEventListener('resize', () => setPage(page, 0, false));
}

// ── clock ─────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    const now = new Date();
    let h = now.getHours() % 12;
    if (h === 0) h = 12;
    el.textContent = `${h}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 10000);
}

/**
 * The icons that turn into basketballs: whatever page you're looking at, plus
 * the dock. Apps on the other page are off-screen, so dragging them into the
 * game would just spray balls in from nowhere.
 */
export const activeIcons = () => [
  ...document.querySelectorAll(`.page[data-page="${page}"] .app`),
  ...document.querySelectorAll('#dock-icons .app'),
];
