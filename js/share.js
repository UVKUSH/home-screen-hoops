/**
 * Getting the game in front of someone else.
 *
 * Two routes out: the system share sheet for the plain link, and X for a score.
 * Neither belongs to the scorecard — the board screen could want them too — so
 * they live here with the toast they both talk through.
 */

const SHARE_TEXT = 'Hold down the Search bar on this and watch what happens 🏀';

// What the post has to do: say what the thing is, say what to DO with it (nobody
// discovers a hold-to-break gesture on their own), and give a reason to pass it
// on. The prank is the reason — it is what the whole page is for.
const X_HOOK  = 'Looks exactly like an iPhone home screen — until you hold down the Search bar and every app icon turns into a basketball 🏀';
const X_DARE  = 'Hand it to someone without telling them what happens.';

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
  const brag = total ? `I got ${score}/${total}. ` : '';
  return `${X_HOOK}\n\n${brag}${X_DARE}`;
}

/**
 * Is this a device where the system share sheet is the better route?
 *
 * Touch-primary and a real phone or tablet. Desktop Safari and Chrome both
 * expose navigator.share, but there the intent URL opens a proper composer in a
 * new tab, which is one step rather than two.
 */
function wantsShareSheet() {
  return Boolean(navigator.share)
    && navigator.maxTouchPoints > 0
    && /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
}

/**
 * Get the post in front of the player, by whichever route this device honours.
 *
 * The post always lands on the clipboard first, whatever happens next. X drops
 * prefilled text often enough that opening a composer alone can leave someone
 * staring at an empty box, and a copy costs nothing.
 */
export function shareOnX(result) {
  const body = xMessage(result);
  const link = SHARE_URL();

  // the clipboard copy carries the link; nothing downstream will add it
  const copied = navigator.clipboard?.writeText(`${body}\n\n${link}`);
  const say = (msg) => copied?.then(() => toast(msg)).catch(() => {});

  /*
   * On a phone, hand it to the system share sheet.
   *
   * x.com/intent/post is a WEB address. iOS treats it as a universal link and
   * gives it to the X app, which opens it in its own in-app browser — so you
   * land on the X website with no composer and none of the text. The share
   * sheet is the only route that reaches the real composer, because it passes
   * the post to the app as content rather than as a page to visit.
   *
   * Called straight from the click. navigator.share needs the gesture, and so
   * does the clipboard write above, which is why neither is awaited first.
   */
  if (wantsShareSheet()) {
    navigator.share({ text: body, url: link })
      .catch(() => { /* dismissed, or no app took it — the copy is the backstop */ });
    say('Copied too, in case you’d rather paste it');
    return;
  }

  // Desktop: the web intent opens a real composer in a new tab. twitter.com
  // rather than x.com — it is the older endpoint and the one still handled
  // everywhere, and it redirects to x.com on its own.
  const composer = 'https://twitter.com/intent/tweet'
    + `?text=${encodeURIComponent(body)}`
    + `&url=${encodeURIComponent(link)}`;
  // a new tab rather than replacing the game — on a home-screen web app that
  // would dump the player out into Safari and lose the round
  const opened = window.open(composer, '_blank', 'noopener,noreferrer');

  // Only ever claim what actually happened. With no clipboard at all — an
  // insecure origin, or an older browser — say nothing rather than lie about it.
  say(opened ? 'Copied — paste it if X didn’t fill it in'
             : 'Copied — open X and paste it');
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
