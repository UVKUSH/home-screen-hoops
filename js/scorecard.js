import { leaderboardOn, submitScore } from './api.js';
import { renderRows } from './board.js';
import { shareLink, shareOnX } from './share.js';

// The name the player last put on the board. The Reminders screen highlights
// it, so opening the board cold still shows you where you stand. Only the
// display name — the one already public on the board — is kept.
const NAME_KEY = 'hoops:name';

export function rememberedName() {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;   // private mode, or storage switched off
  }
}

function remember(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* not worth interrupting a submission over */
  }
}

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
      remember(name);
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
    // shared with the Reminders app screen — see js/board.js
    renderRows(boardEl, top, { rank, name });

    youEl.textContent = rank
      ? (rank <= (top?.length ?? 0) ? `You're #${rank}` : `You're #${rank} — keep at it`)
      : '';
  }

  document.getElementById('share').addEventListener('click', shareLink);

  // `last` is read at click time, not bound now: the board panel's copy of this
  // button exists before a score does
  for (const btn of root.querySelectorAll('[data-share-x]')) {
    btn.addEventListener('click', () => shareOnX(last));
  }
  document.getElementById('again2').addEventListener('click', () => { close(); onAgain(); });
  document.getElementById('quit2').addEventListener('click', () => { close(); onHome(); });
  document.getElementById('again').addEventListener('click', () => { close(); onAgain(); });
  document.getElementById('quit').addEventListener('click', () => { close(); onHome(); });

  return { open, close };
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
