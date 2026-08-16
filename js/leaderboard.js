import { leaderboardOn, fetchTop, submitScore } from './api.js';

const SHARE_TEXT = 'Hold down the Search bar on this and watch what happens 🏀';

// Tap-to-finish email endings. Typing "@gmail.com" on a phone keyboard is a
// lot of taps for something almost everyone picks from the same short list.
const DOMAINS = ['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com', '@hotmail.com'];

/**
 * Everything that happens after the last shot: the result, the sign-up form,
 * the board, the share prompt and the add-to-home-screen walkthrough.
 *
 * The game owns the score; this owns the screens.
 */
export function createScorecard({ onAgain, onHome }) {
  const root   = document.getElementById('scorecard');
  const panels = {
    result: root.querySelector('[data-panel="result"]'),
    join:   root.querySelector('[data-panel="join"]'),
    board:  root.querySelector('[data-panel="board"]'),
  };

  const joinBtn = document.getElementById('join');
  const form    = panels.join;
  const nameEl  = document.getElementById('f-name');
  const contact = document.getElementById('f-contact');
  const errEl   = document.getElementById('f-err');
  const goBtn   = document.getElementById('f-go');
  const boardEl = document.getElementById('board');
  const youEl   = document.getElementById('you-rank');

  let last = { score: 0, total: 0 };

  // ── panels ──────────────────────────────────────────────────
  function show(which) {
    for (const [key, el] of Object.entries(panels)) el.hidden = key !== which;
  }

  function open(score, total, rankName) {
    last = { score, total };
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-total').textContent = `/ ${total}`;
    document.getElementById('final-rank').textContent = rankName;
    // one primary button per screen: joining wins when it's on offer
    joinBtn.hidden = !leaderboardOn();
    document.getElementById('again').classList.toggle('ghost', !joinBtn.hidden);
    show('result');
    root.classList.add('show');
  }

  function close() {
    root.classList.remove('show');
    show('result');
  }

  // ── sign up ─────────────────────────────────────────────────
  joinBtn.addEventListener('click', () => {
    show('join');
    setTimeout(() => nameEl.focus(), 250);   // after the panel has settled
  });

  root.querySelector('[data-back]').addEventListener('click', () => {
    errEl.hidden = true;
    show('result');
  });

  // ── tap-to-finish email endings ─────────────────────────────
  const chipsEl = document.getElementById('domain-chips');
  for (const domain of DOMAINS) {
    const chip = document.createElement('button');
    chip.type = 'button';          // must not submit the form
    chip.className = 'chip';
    chip.textContent = domain;
    chip.addEventListener('click', () => {
      const local = contact.value.trim().split('@')[0];
      if (!local) return contact.focus();   // nothing to attach it to yet
      contact.value = local + domain;
      errEl.hidden = true;
      updateChips();
    });
    chipsEl.appendChild(chip);
  }

  /** Hide the endings once they'd be no help: a finished email, or a phone. */
  function updateChips() {
    const value = contact.value.trim();
    const complete = looksLikeEmail(value);
    const phoneish = value !== '' && !value.includes('@') && /^[+(\d][\d\s()\-.]*$/.test(value);
    chipsEl.hidden = complete || phoneish;
  }

  contact.addEventListener('input', updateChips);
  updateChips();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (goBtn.disabled) return;

    // Checked again on the server — this is just so the player gets told
    // immediately rather than after a round trip.
    const name = nameEl.value.trim();
    const who  = contact.value.trim();
    if (name.length < 1)  return fail('Pop your name in first.');
    if (!looksLikeContact(who)) return fail('Needs a real email address or phone number.');

    errEl.hidden = true;
    goBtn.disabled = true;
    goBtn.textContent = 'Sending…';

    try {
      const { rank, top } = await submitScore({ name, contact: who, ...last });
      renderBoard(top, rank, name);
      show('board');
    } catch (err) {
      fail(err.message);
    } finally {
      goBtn.disabled = false;
      goBtn.textContent = 'Submit my score';
    }
  });

  function fail(message) {
    errEl.textContent = message;
    errEl.hidden = false;
  }

  // ── the board ───────────────────────────────────────────────
  function renderBoard(top, rank, name) {
    boardEl.replaceChildren();
    (top ?? []).forEach((row, i) => {
      const li = document.createElement('li');
      // the player's own row is highlighted, matched on the position we were
      // given rather than the name, so a namesake doesn't light up too
      if (rank && i + 1 === rank && row.name === name) li.className = 'me';
      li.innerHTML =
        `<span class="pos">${i + 1}</span>` +
        `<span class="who"></span>` +
        `<span class="pts">${Number(row.score)}</span>`;
      li.querySelector('.who').textContent = row.name;   // never as HTML
      boardEl.appendChild(li);
    });

    youEl.textContent = rank
      ? (rank <= (top?.length ?? 0) ? `You're #${rank}` : `You're #${rank} — keep at it`)
      : '';
  }

  document.getElementById('share').addEventListener('click', shareIt);
  document.getElementById('again2').addEventListener('click', () => { close(); onAgain(); });
  document.getElementById('quit2').addEventListener('click', () => { close(); onHome(); });
  document.getElementById('again').addEventListener('click', () => { close(); onAgain(); });
  document.getElementById('quit').addEventListener('click', () => { close(); onHome(); });

  return { open, close };
}

// ── share ───────────────────────────────────────────────────────
async function shareIt() {
  const url = location.origin + location.pathname;
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
function toast(text) {
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

// ── add to home screen ──────────────────────────────────────────
export function wireInstallHelp() {
  const panel = document.getElementById('install');
  const open = () => { panel.hidden = false; };
  const close = () => { panel.hidden = true; };

  for (const btn of document.querySelectorAll('[data-install]')) {
    // pointless advice if they're already running it from the home screen
    btn.hidden = document.body.classList.contains('standalone');
    btn.addEventListener('click', open);
  }
  panel.querySelector('[data-close-install]').addEventListener('click', close);
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
}

// ── shared with the server, deliberately loose ──────────────────
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function looksLikeContact(value) {
  if (looksLikeEmail(value)) return true;
  const digits = value.replace(/\D/g, '');
  return /^[+(\d][\d\s()\-.]{6,}$/.test(value) && digits.length >= 7 && digits.length <= 15;
}
