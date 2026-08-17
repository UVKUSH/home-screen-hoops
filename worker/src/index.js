/**
 * Leaderboard API for Home Screen Hoops.
 *
 *   GET  /api/top          -> the top scores. Name and score only.
 *   POST /api/score        -> submit { name, contact, score, total }
 *   cron                   -> the retention sweep. See sweep() below.
 *
 * Contact details are written to the database and are never read back out by
 * any route — the public SELECTs name the columns explicitly rather than using
 * SELECT *, so a new column can't accidentally start being published. They also
 * expire: see the retention section.
 */

const TOP_LIMIT     = 25;
const MAX_NAME      = 18;
const MAX_CONTACT   = 120;
const MAX_BODY      = 2048;      // bytes; the payload is four short fields
const RATE_PER_HOUR = 12;        // submissions per IP

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsFor(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/api/top' && request.method === 'GET') {
        return json({ top: await topScores(env) }, 200, cors);
      }
      if (url.pathname === '/api/score' && request.method === 'POST') {
        return await submit(request, env, cors);
      }
      return json({ error: 'Not found' }, 404, cors);
    } catch (err) {
      console.error(JSON.stringify({
        message: 'unhandled error',
        error: err?.message,
        path: url.pathname,
      }));
      return json({ error: 'Something went wrong. Try again.' }, 500, cors);
    }
  },

  /**
   * The retention sweep, on the cron in wrangler.jsonc. Logged either way — a
   * privacy promise that silently stopped being kept is worse than none.
   */
  async scheduled(event, env) {
    try {
      const cleared = await sweep(env);
      console.log(JSON.stringify({ message: 'retention sweep', ...cleared }));
    } catch (err) {
      console.error(JSON.stringify({ message: 'retention sweep failed', error: err?.message }));
      throw err;              // let it show as a failed run rather than a quiet no-op
    }
  },
};

// ── routes ────────────────────────────────────────────────────
async function topScores(env) {
  const { results } = await env.DB
    .prepare('SELECT name, score, total, at FROM scores ORDER BY score DESC, at ASC LIMIT ?')
    .bind(TOP_LIMIT)
    .all();
  return results ?? [];
}

async function submit(request, env, cors) {
  const raw = await readCapped(request, MAX_BODY);
  if (raw === null) return json({ error: 'That request was too large.' }, 413, cors);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Could not read that.' }, 400, cors);
  }

  const name = cleanName(body?.name);
  if (!name) return json({ error: `Add a name, up to ${MAX_NAME} characters.` }, 400, cors);

  const contact = cleanContact(body?.contact);
  if (!contact) return json({ error: 'Add a real email address or phone number.' }, 400, cors);

  const total = toInt(body?.total);
  const score = toInt(body?.score);
  if (total === null || total < 1 || total > 40 || score === null || score < 0 || score > total) {
    return json({ error: "That score doesn't add up." }, 400, cors);
  }

  const ipHash = await hashIp(request, env);
  const recent = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM scores WHERE ip_hash = ? AND at > ?')
    .bind(ipHash, Date.now() - 3_600_000)
    .first();
  if ((recent?.n ?? 0) >= RATE_PER_HOUR) {
    return json({ error: 'Plenty of scores from here already — try again later.' }, 429, cors);
  }

  const at = Date.now();
  await env.DB
    .prepare('INSERT INTO scores (name, contact, score, total, at, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, contact, score, total, at, ipHash)
    .run();

  // rank = everyone strictly better, plus everyone level who got there first
  const row = await env.DB
    .prepare('SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ? OR (score = ? AND at < ?)')
    .bind(score, score, at)
    .first();

  return json({ rank: row?.rank ?? null, top: await topScores(env) }, 200, cors);
}

// ── input handling ────────────────────────────────────────────
/** Read the body through the stream so an oversized upload is dropped early. */
async function readCapped(request, limit) {
  if (Number(request.headers.get('content-length') || 0) > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';

  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}

/** Names are shown publicly, so strip anything that isn't printable text. */
export function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value
    // control characters, plus the zero-width and bidi-override tricks that
    // let a name render as something other than what is stored
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name.length >= 1 && name.length <= MAX_NAME ? name : null;
}

export function cleanContact(value) {
  if (typeof value !== 'string') return null;
  const contact = value.trim();
  if (!contact || contact.length > MAX_CONTACT) return null;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) return contact;

  const digits = contact.replace(/\D/g, '');
  // leading "(" matters: plenty of people write (555) 010-9999
  if (/^[+(\d][\d\s()\-.]{6,}$/.test(contact) && digits.length >= 7 && digits.length <= 15) {
    return contact;
  }
  return null;
}

export function toInt(value) {
  // Number('') , Number(null) and Number([]) are all 0, so a missing field
  // would otherwise arrive as a perfectly valid score of zero.
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/**
 * Rate limiting shouldn't mean keeping everyone's IP address. Salted SHA-256,
 * truncated — enough to count repeats, not enough to work backwards from.
 * Set the salt with: wrangler secret put RATE_SALT
 */
async function hashIp(request, env) {
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const data = new TextEncoder().encode(`${ip}|${env.RATE_SALT ?? 'hoops'}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── retention ─────────────────────────────────────────────────
/**
 * Personal data gets an expiry date; scores don't.
 *
 * The form asks for an email or phone and promises to keep it private. Keeping
 * it private forever is not the same as keeping it forever — the reason it was
 * collected, being able to reach whoever is at the top, stops applying long
 * before the score stops being interesting. So the private half expires and the
 * public half doesn't: the row survives with its name and score, which is the
 * whole point of a leaderboard, and the contact is emptied out from under it.
 *
 * ip_hash goes sooner. It exists to count submissions in the last hour and is
 * dead weight after that; the week is slack for looking into a burst of abuse.
 */
const KEEP_CONTACT_DAYS = 90;
const KEEP_IP_DAYS = 7;
const DAY_MS = 86_400_000;

/** Anything stamped before these is past its purpose. Pure, so it can be tested. */
export function retentionCutoffs(now, keep = {}) {
  const contactDays = keep.contactDays ?? KEEP_CONTACT_DAYS;
  const ipDays = keep.ipDays ?? KEEP_IP_DAYS;
  return { contact: now - contactDays * DAY_MS, ip: now - ipDays * DAY_MS };
}

/**
 * Clear out what's expired. Safe to run as often as you like — the WHERE clauses
 * skip rows already dealt with, so a repeat sweep touches nothing.
 *
 * `contact` is NOT NULL in the schema, so it empties to '' rather than NULL.
 */
export async function sweep(env, now = Date.now(), keep) {
  const cut = retentionCutoffs(now, keep);
  const [contact, ip] = await env.DB.batch([
    env.DB.prepare("UPDATE scores SET contact = '' WHERE at < ? AND contact != ''")
      .bind(cut.contact),
    env.DB.prepare('UPDATE scores SET ip_hash = NULL WHERE at < ? AND ip_hash IS NOT NULL')
      .bind(cut.ip),
  ]);
  return {
    contactsCleared: contact?.meta?.changes ?? 0,
    ipsCleared: ip?.meta?.changes ?? 0,
  };
}

// ── plumbing ──────────────────────────────────────────────────
/**
 * Is this origin someone's own machine?
 *
 * The dev server takes its port at runtime so several editors can serve the
 * folder at once, which means there is no one port to name in ALLOWED_ORIGINS —
 * pinning one would leave the leaderboard working only in whichever window got
 * there first.
 *
 * Parsed rather than prefix-matched on purpose: "localhost" and
 * "localhost.example.com" start with the same nine characters and only one of
 * them is your machine. Letting these through costs nothing that isn't already
 * available — the board is public and there are no cookies or credentials on
 * this API, so anything a browser could do here, curl could already do without
 * asking CORS first.
 */
function isLocal(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;                 // '', 'null', or anything unparseable
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
}

export function corsFor(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('origin') ?? '';
  const ok = allowed.includes(origin) || isLocal(origin);

  return {
    // A caller we don't know still gets a header, just not their own origin —
    // the mismatch is what the browser refuses on.
    'access-control-allow-origin': ok ? origin : (allowed[0] ?? ''),
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(body, status, cors) {
  return Response.json(body, {
    status,
    headers: { ...cors, 'cache-control': 'no-store' },
  });
}
