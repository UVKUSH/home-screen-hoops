import { COLS, ROWS, INDEX } from './sprite.js';
import * as sound from './sound.js';

/**
 * Tap the UVY icon.
 *
 * Icons here come from the same sprite cell the home screen uses, so they're
 * guaranteed to be the real artwork rather than a copy that can drift.
 *
 * The card also quietly points at the next secret — an easter egg nobody can
 * find isn't much of a reward, and one hidden thing hinting at the next is how
 * people end up hunting for the rest.
 */
let card = null;

export function showUvy() {
  card ??= build();
  card.hidden = false;
  // replay the entrance on every open, not just the first
  const inner = card.querySelector('.card');
  inner.style.animation = 'none';
  void inner.offsetWidth;
  inner.style.animation = '';
  sound.star();
}

/** Inline styles that point a background at one cell of the sprite sheet. */
function cell(id) {
  const n = INDEX[id] ?? 0;
  const col = n % COLS;
  const row = Math.floor(n / COLS);
  const x = COLS > 1 ? (col / (COLS - 1)) * 100 : 0;
  const y = ROWS > 1 ? (row / (ROWS - 1)) * 100 : 0;
  return `background-position:${x.toFixed(3)}% ${y.toFixed(3)}%;` +
         `background-size:${COLS * 100}% ${ROWS * 100}%`;
}

function build() {
  const el = document.createElement('div');
  el.id = 'uvy';
  el.hidden = true;
  el.innerHTML =
    `<div class="card">` +
      `<div class="uvy-icon" style="${cell('uvy')}"></div>` +
      `<h2 class="uvy-title">You finally became a star on UVY</h2>` +
      `<p class="uvy-sub">[ united voice of youth ]</p>` +
      `<p class="uvy-hint">` +
        `<span class="hint-icon" style="${cell('settings')}"></span>` +
        // one span, or the <b> becomes its own flex item and the words scatter
        `<span class="hint-text">psst — now try tapping <b>Settings</b> seven times</span>` +
      `</p>` +
      `<button type="button" data-close>Let's go</button>` +
    `</div>`;

  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  document.body.appendChild(el);
  return el;
}
