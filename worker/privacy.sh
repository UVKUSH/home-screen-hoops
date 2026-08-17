#!/usr/bin/env bash
# What we hold on people, and how to stop holding it.
#
#   ./privacy.sh sweep            apply the retention rules right now
#   ./privacy.sh show   <contact> what the database has on one person
#   ./privacy.sh forget <contact> drop their contact details, keep their score
#   ./privacy.sh erase  <contact> remove them from the board entirely
#
# The cron in wrangler.jsonc already runs `sweep` daily, so that one is only for
# when you don't want to wait. The others are for when someone asks — which they
# are entitled to do, the form having promised their details stay private.
#
# `forget` is the one to reach for. It clears the private half and leaves the
# name and score standing, so the board doesn't develop a hole where someone
# used to be. `erase` is for when they want the whole entry gone.
set -euo pipefail

cd "$(dirname "$0")"
DB="hoops"
WRANGLER=(npx --yes wrangler@latest d1 execute "$DB" --remote --yes)

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
  [ $# -ge 1 ] && [ -n "${1:-}" ] || die "which person? pass their email or phone"
}

run() { "${WRANGLER[@]}" --command "$1"; }

cutoff_ms() {  # days -> epoch ms, that many days ago
  python3 -c "import time,sys; print(int(time.time()*1000) - int(sys.argv[1])*86400000)" "$1"
}

case "${1:-}" in
  sweep)
    contact_cut=$(cutoff_ms "$KEEP_CONTACT_DAYS")
    ip_cut=$(cutoff_ms "$KEEP_IP_DAYS")
    echo "==> Clearing contacts older than $KEEP_CONTACT_DAYS days"
    run "UPDATE scores SET contact = '' WHERE at < $contact_cut AND contact != ''"
    echo "==> Clearing ip hashes older than $KEEP_IP_DAYS days"
    run "UPDATE scores SET ip_hash = NULL WHERE at < $ip_cut AND ip_hash IS NOT NULL"
    echo "==> Still held"
    run "SELECT COUNT(*) AS rows_total,
                SUM(contact != '') AS with_contact,
                SUM(ip_hash IS NOT NULL) AS with_ip_hash
         FROM scores"
    ;;

  show)
    shift; need_contact "$@"
    who=$(sql_quote "$1")
    run "SELECT id, name, score, total,
                datetime(at/1000, 'unixepoch') AS submitted,
                contact,
                (ip_hash IS NOT NULL) AS has_ip_hash
         FROM scores WHERE contact = '$who' ORDER BY at DESC"
    ;;

  forget)
    shift; need_contact "$@"
    who=$(sql_quote "$1")
    echo "==> Dropping contact details for $1 (score stays on the board)"
    run "UPDATE scores SET contact = '', ip_hash = NULL WHERE contact = '$who'"
    ;;

  erase)
    shift; need_contact "$@"
    who=$(sql_quote "$1")
    read -rp "Remove every entry for $1, scores included? [y/N] " ok
    [ "$ok" = "y" ] || die "left alone"
    run "DELETE FROM scores WHERE contact = '$who'"
    ;;

  *)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
