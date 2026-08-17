# Reminders opens the leaderboard

**2026-08-16**

Tapping Reminders on the home screen opens the leaderboard as a full app screen,
rather than the board being reachable only by finishing a game and submitting a
score.

`fetchTop()` has existed in `js/api.js` since the leaderboard went in, has been
imported by the scorecard the whole time, and has never been called. The
standalone "just read the board" path was built and left unused. This is what it
was for.

## Layering

The screen sits above the home screen and below the home bar, so the bar stays
on top as both chrome and the exit affordance — the way it behaves on a phone.

```
z 220  #toast
z 216  #uvy            secrets; cannot be open at the same time as the board
z 215  #dials
z 210  #install
z  95  #statusbar      moved out of #home
z  90  #homebar
z  80  #board-screen   new
z  20  #court
   —   #home
```

`#home` sets `position: fixed` with no `z-index`, so it creates no stacking
context and a sibling slots cleanly between it and the home bar.

### The status bar moves

`#statusbar` was the first flex child of `#home`. For it to persist across
screens it becomes a `<body>` child, `position: fixed`, `z-index: 95`. That is
what it always was — phone chrome, not part of the home screen. The two rules
that already treat it that way (`body.standalone` hides it, `body.playing` fades
it) are body-scoped and keep working unchanged. `#home` takes on the 22px of
padding the status bar used to occupy.

## Modules

| File | Responsibility |
| --- | --- |
| `js/board.js` (new) | `renderRows(ol, top, opts)`. Pure renderer, nothing else. |
| `js/boardscreen.js` (new) | Owns `#board-screen`: build, fetch, states, exit. |
| `js/scorecard.js` (renamed) | Was `leaderboard.js`. Uses `renderRows`. |

The renderer was private to `createScorecard`. Two callers need it, so it comes
out into its own module rather than being copied.

`leaderboard.js` is renamed to `scorecard.js` because it exports
`createScorecard` and owns the end-of-game flow — it is not the leaderboard, and
sitting next to `board.js` and `boardscreen.js` that name would actively mislead.

`boardscreen.js` follows the pattern `uvy.js` and `dials.js` already use: a
module that builds its own panel on first open, appends it to `<body>`, and
toggles `hidden`.

## Wiring

`makeIcon`'s chain of special cases becomes a map:

```js
const OPENS = {
  settings:  countSettingsTap,          // true only on the seventh tap
  uvy:       () => (showUvy(), true),
  reminders: () => (showBoard(), true),
};
if (OPENS[app.id]?.()) return;          // otherwise fall through to the wobble
```

With no backend configured (`!leaderboardOn()`) Reminders is not special and
does the ordinary "nope" wobble. No empty screen.

## States

Re-fetches on every open, so it is never stale.

- **Loading** — dim skeleton rows, no spinner
- **Rows** — `renderRows`, top 25
- **Empty** — "No scores yet. Be the first."
- **Error** — the message from `api.js`, plus Retry

## Exit

`EXIT_STRIP` and `EXIT_PULL` move from `main.js` into `config.js`, so the
home-swipe distance has one definition shared by the game and this screen.

- Swipe up from the bottom — the same gesture, and the same numbers, as quitting
  a game
- **Done**, top right
- **Esc**

While the screen is open `#home` gets `inert`, mirroring how the game hides it,
so icons behind are neither clickable nor tabbable.

## Your own row

On a successful submit the scorecard writes the player's name to
`localStorage` under `hoops:name`. The screen highlights the first row matching
it. Without this the board is anonymous when opened cold from the home screen,
which is the normal way in.

Only the display name is stored — the name already published on the board.
Contact details are never written to the client.

## Tests

- `test/board.test.js` — `renderRows`: order, the `.me` highlight, empty input,
  and that a name containing markup lands as text rather than HTML.
- `test/styles.test.js` — `#board-screen` joins the `PANELS` list, so the
  stylesheet guard covers it for free.
