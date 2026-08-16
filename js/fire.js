/**
 * The "on fire" streak — three in a row and the ball starts burning.
 *
 * Embers are plain divs that fade themselves out and are removed on
 * animationend. There's no pool and no per-frame bookkeeping: the browser
 * animates them off the main thread, and a hard cap stops a long streak from
 * filling the DOM.
 */

const MAX_EMBERS = 70;
let live = 0;
let layer = null;

/** Drop a fading spark at a ball's position. */
export function ember(x, y, r) {
  if (live >= MAX_EMBERS) return;
  layer ??= document.getElementById('embers');
  if (!layer) return;

  const size = r * (0.45 + Math.random() * 0.5);
  const el = document.createElement('i');
  el.className = 'ember';
  el.style.cssText =
    `left:${(x - size / 2).toFixed(1)}px;` +
    `top:${(y - size / 2).toFixed(1)}px;` +
    `width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;` +
    `--drift:${(Math.random() * 2 - 1) * 18}px`;

  layer.appendChild(el);
  live++;
  el.addEventListener('animationend', () => { el.remove(); live--; }, { once: true });
}

export function clearEmbers() {
  layer ??= document.getElementById('embers');
  if (layer) layer.replaceChildren();
  live = 0;
}
