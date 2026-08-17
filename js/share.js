/**
 * Getting the game in front of someone else.
 *
 * Two routes out: the system share sheet for the plain link, and X for a score.
 * Neither belongs to the scorecard — the board screen could want them too — so
 * they live here with the toast they both talk through.
 */

const SHARE_TEXT = 'Hold down the Search bar on this and watch what happens 🏀';

// X gets its own wording — reusing the share text put the basketball in twice
const X_TAGLINE = 'Hold down the Search bar and watch the phone fall apart.';

export const SHARE_URL = () => location.origin + location.pathname;

/**
 * The post itself, without the link.
 *
 * X's intent takes the text and the URL as separate parameters and joins them,
 * so the link is appended only for the clipboard copy — see shareOnX.
 *
 * @param {{score?: number, total?: number}} [result]  omitted before any game
 */
export function xMessage({ score, total } = {}) {
  return total
    ? `I scored ${score}/${total} on Home Screen Hoops 🏀\n\n${X_TAGLINE}`
    : `Home Screen Hoops 🏀\n\n${X_TAGLINE}`;
}

/**
 * Copy the post and open X's composer, in that order, in one tap.
 *
 * X drops the prefilled text often enough — the app in particular tends to —
 * that opening the composer alone leaves people staring at an empty box. So the
 * post goes on the clipboard first and they can paste it, whatever X does with
 * the parameters.
 *
 * Both calls have to be MADE inside the click and before anything is awaited:
 * iOS grants clipboard access for the gesture only, and a window.open that
 * happens after an await is a popup and gets blocked. Hence fire both, then
 * report afterwards.
 */
export function shareOnX(result) {
  const body = xMessage(result);
  const link = SHARE_URL();

  // the clipboard copy carries the link; nothing downstream will add it
  const copied = navigator.clipboard?.writeText(`${body}\n\n${link}`);

  const composer = 'https://x.com/intent/post'
    + `?text=${encodeURIComponent(body)}`
    + `&url=${encodeURIComponent(link)}`;
  // a new tab rather than replacing the game — on a home-screen web app that
  // would dump the player out into Safari and lose the round
  const opened = window.open(composer, '_blank', 'noopener,noreferrer');

  // Only ever claim what actually happened. With no clipboard at all — an
  // insecure origin, or an older browser — say nothing rather than lie about it.
  copied
    ?.then(() => toast(opened
      ? 'Copied — paste it if X didn’t fill it in'
      : 'Copied — open X and paste it'))
    .catch(() => { /* refused; the composer is still open */ });
}

/** The plain link, through the system share sheet where there is one. */
export async function shareLink() {
  const url = SHARE_URL();
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Home Screen Hoops', text: SHARE_TEXT, url });
      return;
    } catch {
      /* dismissed — fall through to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied — go break someone else’s phone');
  } catch {
    toast(url);
  }
}

let toastTimer = null;

export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
