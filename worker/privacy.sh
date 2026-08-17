#!/usr/bin/env bash
# What we hold on people, and how to stop holding it.
#
#   ./privacy.sh list             everyone whose contact details we still have
#   ./privacy.sh show   <contact> what the database has on one person
#   ./privacy.sh forget <contact> drop their contact details, keep their score
#   ./privacy.sh erase  <contact> remove them from the board entirely
#   ./privacy.sh sweep            apply the retention rules right now
#
# The cron in wrangler.jsonc already runs `sweep` daily, so that one is only for
# when you don't want to wait. The others are for when someone asks — which they
# are entitled to do, the form having promised their details stay private.
#
# Start with `list`: it prints the contact values, which is where the argument
# for the other commands comes from. Guessing at an address gets you nothing,
# because nothing is what matches.
#
# `forget` is usually the one to reach for. It clears the private half and leaves
# the name and score standing, so the board doesn't develop a hole where someone
# used to be. `erase` is for when they want the whole entry gone.
set -euo pipefail

cd "$(dirname "$0")"
DB="hoops"
WRANGLER=(npx --yes wrangler@latest d1 execute "$DB" --remote --yes --json)

# Retention windows — keep these in step with src/index.js.
KEEP_CONTACT_DAYS=90
KEEP_IP_DAYS=7

die() { echo "!! $*" >&2; exit 1; }

# Single quotes are the only thing that can break out of a SQL string literal,
# and doubling them is how SQLite escapes them. Nothing here is ever run against
# a value that hasn't been through this.
#
# The quotes come from a variable rather than being backslash-escaped inline:
# bash leaves the backslashes in a ${//} replacement, so the obvious spelling
# yields \'\' instead of '', and since SQLite doesn't treat \ as an escape that
# closes the string one character early — the precise thing this is here to stop.
sql_quote() {
  local q="'"
  printf '%s' "${1//$q/$q$q}"
}

need_contact() {
  [ -n "${1:-}" ] || die "which person? pass their email or phone — './privacy.sh list' shows them"
}

# Wrangler's own output for an empty result set is a blank line, which reads as
# "it silently did nothing" rather than "there was nothing". This says which.
render() {
  python3 -c '
import json, sys
mode, label = sys.argv[1], sys.argv[2]
try:
    payload = json.load(sys.stdin)
except Exception:
    print("   !! could not read the database response", file=sys.stderr)
    sys.exit(1)

blocks = payload if isinstance(payload, list) else [payload]
rows, changes = [], 0
for b in blocks:
    rows += b.get("results") or []
    changes += (b.get("meta") or {}).get("changes") or 0

def plural(n):
    return "" if n == 1 else "s"

if mode == "changed":
    print(f"   {label}: {changes} row{plural(changes)}")
    sys.exit(0)

if not rows:
    print(f"   {label}: nothing")
    sys.exit(0)

cols = list(rows[0].keys())
width = {c: max([len(c)] + [len(str(r.get(c, ""))) for r in rows]) for c in cols}
line = lambda vals: "   " + "  ".join(str(v).ljust(width[c]) for c, v in zip(cols, vals))
print(line(cols))
print(line(["-" * width[c] for c in cols]))
for r in rows:
    print(line([r.get(c, "") for c in cols]))
print(f"\n   {label}: {len(rows)} row{plural(len(rows))}")
' "$1" "$2"
}

run()  { "${WRANGLER[@]}" --command "$1" 2>/dev/null | render table   "$2"; }
edit() { "${WRANGLER[@]}" --command "$1" 2>/dev/null | render changed "$2"; }

cutoff_ms() {  # days -> epoch ms, that many days ago
  python3 -c "import time,sys; print(int(time.time()*1000) - int(sys.argv[1])*86400000)" "$1"
}

case "${1:-}" in
  list)
    run "SELECT id, name, score,
                datetime(at/1000, 'unixepoch') AS submitted,
                contact,
                (ip_hash IS NOT NULL) AS ip
         FROM scores WHERE contact != '' ORDER BY at DESC" "contact details held"
    ;;

  show)
    need_contact "${2:-}"
    who=$(sql_quote "$2")
    run "SELECT id, name, score, total,
                datetime(at/1000, 'unixepoch') AS submitted,
                contact,
                (ip_hash IS NOT NULL) AS ip
         FROM scores WHERE contact = '$who' ORDER BY at DESC" "held for $2"
    ;;

  forget)
    need_contact "${2:-}"
    who=$(sql_quote "$2")
    echo "==> Dropping contact details for $2 (score stays on the board)"
    edit "UPDATE scores SET contact = '', ip_hash = NULL WHERE contact = '$who'" "cleared"
    ;;

  erase)
    need_contact "${2:-}"
    who=$(sql_quote "$2")
    read -rp "Remove every entry for $2, scores included? [y/N] " ok
    [ "$ok" = "y" ] || die "left alone"
    edit "DELETE FROM scores WHERE contact = '$who'" "deleted"
    ;;

  sweep)
    echo "==> Clearing contacts older than $KEEP_CONTACT_DAYS days"
    edit "UPDATE scores SET contact = '' \
          WHERE at < $(cutoff_ms "$KEEP_CONTACT_DAYS") AND contact != ''" "cleared"
    echo "==> Clearing ip hashes older than $KEEP_IP_DAYS days"
    edit "UPDATE scores SET ip_hash = NULL \
          WHERE at < $(cutoff_ms "$KEEP_IP_DAYS") AND ip_hash IS NOT NULL" "cleared"
    echo "==> Still held"
    run "SELECT COUNT(*) AS rows_total,
                SUM(contact != '') AS with_contact,
                SUM(ip_hash IS NOT NULL) AS with_ip_hash
         FROM scores" "summary"
    ;;

  *)
    sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
