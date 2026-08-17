/**
 * "Add it to your home screen", told correctly for the browser you're actually
 * in — and shown once, on the first visit.
 *
 * This matters more here than for most web apps: installed, the page runs with
 * no address bar and no toolbar, which is the entire joke. Played in a browser
 * tab with Safari's chrome around it, the illusion is half gone. So the prompt
 * comes up before the first game rather than after, and it's the one moment the
 * app admits it's a web page.
 */

const SEEN_KEY = 'hoops.installPrompt.seen';

// Chromium fires this instead of making people dig through a menu. It has to be
// captured at load — by the time the panel opens, the event is long gone.
let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

let panel = null;

// ── who are we talking to ─────────────────────────────────────
/** @param {{userAgent: string, platform?: string, maxTouchPoints?: number}} [nav] */
export function detect(nav = navigator) {
  const ua = nav.userAgent;
  // An iPad reports itself as a Mac; the touch points are what give it away.
  const iPadOS = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;
  const android = /Android/.test(ua);

  // Every iOS browser is WebKit underneath, but only some expose Add to Home
  // Screen in a place people can find.
  const iosOtherBrowser = ios && /CriOS|FxiOS|EdgiOS|OPT\//.test(ua);
  const samsung = /SamsungBrowser/.test(ua);
  const firefox = /Firefox|FxiOS/.test(ua);

  return { ios, android, iosOtherBrowser, samsung, firefox };
}

export function isInstalled() {
  return navigator.standalone === true
    || matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: fullscreen)').matches;
}

// ── what to tell them ─────────────────────────────────────────
const SHARE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2.6v12M12 2.6 8.2 6.4M12 2.6l3.8 3.8" fill="none" stroke="currentColor"
        stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7.2 9.6H4.4v11.8h15.2V9.6h-2.8" fill="none" stroke="currentColor"
        stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const DOTS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
  <circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>`;

const MENU_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round"/></svg>`;

const PLUS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.6" fill="none"
        stroke="currentColor" stroke-width="1.9"/>
  <path d="M12 8.4v7.2M8.4 12h7.2" fill="none" stroke="currentColor"
        stroke-width="1.9" stroke-linecap="round"/></svg>`;

/**
 * Which walkthrough this visitor gets.
 *
 * Every branch carries an `id`. Nothing in the UI uses it — it exists so the
 * tests can pin *which* walkthrough was chosen without pinning its wording, and
 * the copy can then be reworded freely without a test to update.
 *
 * @param {{nav?: object, nativePrompt?: boolean}} [opts]
 *   Both default to the live environment. The tests pass their own so the whole
 *   matrix can be checked without a browser.
 */
export function script({ nav = navigator, nativePrompt } = {}) {
  const d = detect(nav);

  if (nativePrompt ?? Boolean(deferredPrompt)) {
    return {
      id: 'native',
      lead: 'One tap and it lives on your home screen — no address bar, no tabs.',
      steps: [],
      install: true,
    };
  }

  if (d.ios && !d.iosOtherBrowser) {
    return {
      id: 'ios-safari',
      lead: 'Two taps and it looks like a real phone.',
      steps: [
        { icon: SHARE_ICON, text: 'Tap <b>Share</b> at the bottom of Safari' },
        { icon: PLUS_ICON, text: 'Scroll down, tap <b>Add to Home Screen</b>' },
      ],
      arrow: true,          // Safari's Share button really is down there
    };
  }

  if (d.iosOtherBrowser) {
    return {
      id: 'ios-other',
      lead: 'This one needs Safari — other iPhone browsers can’t add it properly.',
      steps: [
        { icon: DOTS_ICON, text: 'Open this page in <b>Safari</b>' },
        { icon: SHARE_ICON, text: 'Tap <b>Share</b>, then <b>Add to Home Screen</b>' },
      ],
    };
  }

  if (d.android && d.samsung) {
    return {
      id: 'samsung',
      lead: 'Two taps and it looks like a real phone.',
      steps: [
        { icon: MENU_ICON, text: 'Tap the <b>menu</b> button' },
        { icon: PLUS_ICON, text: 'Tap <b>Add page to</b>, then <b>Home screen</b>' },
      ],
    };
  }

  if (d.android) {
    return {
      id: 'android',
      lead: 'Two taps and it looks like a real phone.',
      steps: [
        // Firefox's is a hamburger, not three dots — naming the wrong glyph is
        // exactly the kind of "helpful" instruction that strands people
        { icon: DOTS_ICON, text: `Tap the <b>${d.firefox ? 'menu' : 'three dots'}</b> at the top` },
        { icon: PLUS_ICON, text: 'Tap <b>Install</b> or <b>Add to Home screen</b>' },
      ],
    };
  }

  // desktop, or something we don't recognise
  return {
    id: 'desktop',
    lead: 'It’s built for a phone — open it there and add it to your home screen.',
    steps: [
      { icon: SHARE_ICON, text: 'Open this link on your phone' },
      { icon: PLUS_ICON, text: 'Add it to the home screen and the address bar disappears' },
    ],
  };
}

// ── the panel ─────────────────────────────────────────────────
function build() {
  const el = document.createElement('div');
  el.id = 'install';
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

function render(el) {
  const s = script();

  el.innerHTML =
    `<div class="card">` +
      `<p class="eyebrow">Make it look real</p>` +
      `<h2 class="ttl">Add it to your home screen</h2>` +
      `<p class="lead">${s.lead}</p>` +
      (s.steps.length
        ? `<ol class="steps">${s.steps.map((step, i) => (
            `<li><span class="n">${i + 1}</span>` +
            `<span class="step-icon">${step.icon}</span>` +
            `<span>${step.text}</span></li>`
          )).join('')}</ol>`
        : '') +
      `<button type="button" data-go>${s.install ? 'Install' : 'Got it'}</button>` +
      `<button type="button" class="ghost" data-close>Not now</button>` +
    `</div>` +
    (s.arrow ? `<div class="point-down" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 4v15M6 13l6 6 6-6" fill="none"
        stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>` : '');

  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);
  el.querySelector('[data-go]').addEventListener('click', async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;       // it can only ever be used once
      close();
      await prompt.prompt();
      return;
    }
    close();
  });
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
}

/** Open it on demand — the "Add this to your home screen" links. */
export function showInstall() {
  panel ??= build();
  render(panel);                   // re-render: a native prompt may have arrived
  panel.hidden = false;
}

/**
 * First visit only, and never once it's already installed. Held back until
 * after the splash so the two don't collide.
 */
export function maybeShowInstall({ delay = 700 } = {}) {
  if (isInstalled()) return;
  try {
    if (localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    return;                        // private mode with storage blocked: skip it
  }
  setTimeout(showInstall, delay);
}

/** Wire the buttons scattered through the end screens. */
export function wireInstallHelp() {
  for (const btn of document.querySelectorAll('[data-install]')) {
    btn.hidden = isInstalled();    // pointless advice if they already did it
    btn.addEventListener('click', showInstall);
  }
}
