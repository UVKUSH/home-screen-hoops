# Home Screen Hoops

A web page that looks exactly like an iPhone home screen. **Press and hold the
Search pill** and every app icon turns into a basketball, drops into a pile at
the bottom, and a hoop swings down from the top. Flick the balls in.

Swipe up from the very bottom edge at any time and everything flies back into
the grid, like nothing happened.

## Try it

**→ [uvkush.github.io/home-screen-hoops](https://uvkush.github.io/home-screen-hoops/)**

Open it on a phone, then **Share → Add to Home Screen**. It launches with no
browser bars at all, which is most of the joke.

To run it locally:

```bash
python3 -m http.server 8765
```

## How to play

- **Hold the Search pill** for about half a second to break the phone
- **Flick the glowing ball upward** toward the hoop — the direction and speed of
  your flick is the shot
- The hoop parks in the left corner for the first two shots, then sweeps corner
  to corner, getting faster as you go
- One shot per app icon on the page you broke (24 on page one, 20 on page two)
- **Tilt** the phone to roll the loose balls around. On iOS you have to tap the
  Tilt chip first — Apple requires a permission prompt before a web page can read
  motion, and firing that prompt on load would give the gag away

## Tuning it

Every number that decides how the game *feels* lives in one place:
[`js/config.js`](js/config.js). Change a value, reload, see what happens.

| Dial | What it does |
| --- | --- |
| `power`, `maxSpeed` | how hard a flick throws |
| `gravity`, `air` | how heavy and floaty the ball is |
| `aimAssist` | 0 is brutally honest, 0.3 bends shots toward the rim |
| `hoopSpeed` | how fast the hoop sweeps — **the one to turn first** |
| `hoopRange` | 1.0 is corner to corner, lower keeps it away from the launch corner |
| `holdMs` | how long you hold Search before it breaks |

## How it works

The trick is that **an app icon and a basketball are the same DOM element.** It
doesn't get replaced — it just stops being a grid item and starts being a physics
body. That's what makes it read as "my phone broke" rather than "a game loaded".

```
index.html          the fake home screen
js/config.js        all the tuning dials
js/apps.js          which apps are on which page
js/homescreen.js    builds the pages, dock, clock, page swiping
js/longpress.js     the hold-to-break trigger
js/transform.js     icons -> balls and back again
js/physics.js       gravity, rim, walls, scoring   (unit tested)
js/hoop.js          the hoop, and how it sweeps
js/game.js          shots, score, scorecard
js/main.js          input and the animation loop
```

Only **one ball is ever in flight**, which is the decision the whole thing rests
on — it removes the hard part of physics (two dozen balls resting on each other
without jittering or sinking) and reduces the engine to about a hundred lines.
The resting pile is only simulated when tilt is switched on.

## The leaderboard

When the last shot is gone you can **keep going**, or put your name up. Only the
name appears on the board — the email or phone is stored privately and no API
route ever reads it back out.

**It's switched off until you deploy the backend.** Until then the game plays
exactly the same, the "Get on the leaderboard" button simply isn't there.

To switch it on:

```bash
cd worker && ./setup.sh
```

That signs you into Cloudflare, creates the D1 database, applies the schema,
sets a rate-limit salt, deploys the Worker, and writes its URL into
`js/config.js`. Then commit and push and it's live.

To read the signups:

```bash
npx wrangler d1 execute hoops --remote --command "SELECT name, contact, score, at FROM scores ORDER BY at DESC LIMIT 50"
```

A few things worth knowing:

- **You're now holding other people's contact details.** They're in your
  Cloudflare account, not in this repo — but they're real personal data, so
  tell people what you'll use them for and delete them when you're done.
- Submissions are rate limited to 12/hour per IP, and IPs are stored only as a
  salted, truncated hash.
- Names are stripped of control, zero-width and bidi characters so nobody can
  make their entry render as something other than what's stored. There's no
  profanity filter — add one if this goes anywhere public.
- Only `https://uvkush.github.io` and localhost may call the API. Change
  `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` if the site moves.

## Changing the icons

Drop a PNG into `assets/icons/`, add it to [`js/apps.js`](js/apps.js), then
repack the sprite:

```bash
npm run build
```

That regenerates `assets/sprite.webp` and `js/sprite.js`. Nothing else is built —
the page runs straight from source.

## Why it loads fast

It's ~130 KB over 15 requests, and everything starts downloading at once.

| | before | after |
| --- | --- | --- |
| requests | 54 | 15 |
| icons | 40 PNGs, 432 KB | 1 sprite, 96 KB |
| wallpaper | 160 KB JPEG | 30 KB WebP |

Three things did it:

- **One sprite instead of 40 icons.** Each icon is a cell of a single WebP, so
  it's one request rather than forty.
- **`modulepreload` on the whole module graph.** ES modules load in waves —
  `main.js` can't request what it imports until it has been fetched and parsed.
  That was three round trips before anything appeared; now the whole graph is
  fetched in parallel.
- **Preloading the images.** Both are referenced from CSS and JS, so they used to
  queue behind the stylesheet and the module graph. Now they start with the HTML.

WebP needs iOS 14+ (2020). Older phones would show a blank grid.

## Tests

```bash
npm test
```

The two parts with real logic are the parts with tests.

**Physics** — scoring must require a *downward* crossing between the posts, rim
clangs must deflect, balls must not tunnel through the floor or walls, and the
aim assist's predicted trajectory is checked against the actual integrator.

**Leaderboard input** — names are public and contact details are required, so
both validators are pinned down: control/zero-width/bidi stripping, email and
phone shapes, length caps, and the fact that `Number(null)` is `0` and must not
sneak through as a valid score.

## Credit

App icons and wallpaper are Apple's, used here for a joke. Everything else is in
this repo.
