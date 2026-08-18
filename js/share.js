/**
 * Getting the game in front of someone else.
 *
 * Two routes out: the system share sheet for the plain link, and X for a score.
 * Neither belongs to the scorecard — the board screen could want them too — so
 * they live here with the toast they both talk through.
 */

/*
 * The post leads with adding it to the home screen, because that is the thing
 * worth converting on — and because the gag does not work any other way. In a
 * browser tab, with an address bar across the top, it is obviously a web page.
 * Installed, there is no chrome at all and it is indistinguishable from the
 * phone it is imitating, which is the entire trick.
 *
 * So the install line is not an instruction the reader has to be talked into.
 * It is the setup, and the prank is the punchline that pays for it.
 */
const X_INSTALL = 'Add this to your home screen first — no address bar, no tabs, it just looks like your phone.';
const X_GAG     = 'Then hand it to a friend and tell them to hold down the Search bar 🏀';

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
  const brag = total ? `\n\nI got ${score}/${total}.` : '';
  return `${X_INSTALL}\n\n${X_GAG}${brag}`;
}

/**
 * Is this a phone, where the X app may be installed to catch a URL scheme?
 *
 * Desktop is excluded deliberately: there the web intent opens a real composer
 * in a new tab, which is already the shortest route.
 *
 * @param {object} [nav]  the environment; the tests pass their own
 */
export function isPhone(nav = navigator) {
  return nav.maxTouchPoints > 0 && /iPhone|iPad|iPod|Android/.test(nav.userAgent);
}

/** The X app's own scheme. `post` opens the composer; `message` carries it all. */
export const xAppUrl = (text) => `twitter://post?message=${encodeURIComponent(text)}`;

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
   * On a phone, go at the X app directly.
   *
   * x.com/intent/post is a WEB address: iOS hands it to the X app as a universal
   * link and the app opens it in its own in-app browser, so you arrive at the X
   * website with no composer and none of the text. twitter:// is the app's own
   * scheme — X still registers it — and `post` opens the composer itself, in one
   * tap rather than two through the share sheet.
   *
   * If the app isn't installed nothing happens and we are simply still here,
   * which is what the timer below is for. It cannot fall back to
   * navigator.share: that needs a user gesture, and by then the click is over.
   * The clipboard copy made above is the backstop instead.
   */
  if (isPhone()) {
    const startedAt = Date.now();
    location.href = xAppUrl(`${body}\n\n${link}`);

    setTimeout(() => {
      // backgrounded, or gone long enough to have left — the app took it
      if (document.hidden || Date.now() - startedAt > 2200) return;
      toast('X didn’t open — the post is copied, paste it anywhere');
    }, 1000);

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

/**
 * The same post, but let the player choose where it goes.
 *
 * The sheet reaches everything the phone knows about — Messages, WhatsApp, Notes
 * — where the X button reaches exactly one place. Two buttons, one post, and the
 * choice is the destination.
 *
 * navigator.share needs the gesture, so this is called straight from the click
 * with nothing awaited in front of it.
 */
export function shareSheet(result) {
  const body = xMessage(result);
  const link = SHARE_URL();
  const copied = navigator.clipboard?.writeText(`${body}\n\n${link}`);

  if (!navigator.share) {                 // button is hidden in this case anyway
    copied?.then(() => toast('Copied — paste it wherever you like')).catch(() => {});
    return;
  }
  navigator.share({ text: body, url: link })
    .catch(() => { /* dismissed; the copy is there if they change their mind */ });
  copied?.then(() => toast('Copied too, in case you’d rather paste it')).catch(() => {});
}

/** Whether the sheet exists to be offered at all. */
export const canShareSheet = () => Boolean(navigator.share);

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
