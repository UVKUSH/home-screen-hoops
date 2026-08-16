#!/usr/bin/env bash
# One-shot setup for the leaderboard backend.
#
#   cd worker && ./setup.sh
#
# Creates the D1 database, writes its id into wrangler.jsonc, applies the
# schema, deploys the Worker, and points the game at it. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"
DB_NAME="hoops"

echo "==> Signing in to Cloudflare (a browser window will open)"
npx --yes wrangler@latest login

# ── database ──────────────────────────────────────────────────
if grep -q "PASTE_DATABASE_ID_HERE" wrangler.jsonc; then
  echo "==> Creating the D1 database"
  CREATE_OUT=$(npx --yes wrangler@latest d1 create "$DB_NAME" 2>&1 || true)
  echo "$CREATE_OUT"

  DB_ID=$(printf '%s' "$CREATE_OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

  # already existed? ask the API for its id instead
  if [ -z "$DB_ID" ]; then
    echo "==> Database already exists, looking up its id"
    DB_ID=$(npx --yes wrangler@latest d1 list --json 2>/dev/null \
      | python3 -c "import json,sys; print(next((d['uuid'] for d in json.load(sys.stdin) if d['name']=='$DB_NAME'), ''))")
  fi

  if [ -z "$DB_ID" ]; then
    echo "!! Could not work out the database id. Run 'npx wrangler d1 list',"
    echo "   then paste the uuid into wrangler.jsonc yourself."
    exit 1
  fi

  python3 - "$DB_ID" <<'PY'
import pathlib, sys
p = pathlib.Path('wrangler.jsonc')
p.write_text(p.read_text().replace('PASTE_DATABASE_ID_HERE', sys.argv[1]))
print(f'==> wrangler.jsonc now points at {sys.argv[1]}')
PY
else
  echo "==> wrangler.jsonc already has a database id, skipping create"
fi

# ── schema ────────────────────────────────────────────────────
echo "==> Applying the schema"
npx --yes wrangler@latest d1 execute "$DB_NAME" --remote --file schema.sql --yes

# ── rate-limit salt ───────────────────────────────────────────
echo "==> Setting the rate-limit salt"
python3 -c "import secrets; print(secrets.token_hex(16))" \
  | npx --yes wrangler@latest secret put RATE_SALT

# ── deploy ────────────────────────────────────────────────────
echo "==> Deploying"
DEPLOY_OUT=$(npx --yes wrangler@latest deploy 2>&1)
echo "$DEPLOY_OUT"

URL=$(printf '%s' "$DEPLOY_OUT" | grep -oE 'https://[a-zA-Z0-9.-]*workers\.dev' | head -1)
if [ -z "$URL" ]; then
  echo "!! Deployed, but couldn't spot the URL above."
  echo "   Copy it and set apiBase in js/config.js by hand."
  exit 0
fi

python3 - "$URL" <<'PY'
import pathlib, re, sys
p = pathlib.Path('../js/config.js')
s = p.read_text()
s = re.sub(r"apiBase:\s*'[^']*'", f"apiBase: '{sys.argv[1]}'", s, count=1)
p.write_text(s)
print(f'==> js/config.js now points at {sys.argv[1]}')
PY

echo
echo "Done. Commit and push, and the leaderboard goes live:"
echo "  git add -A && git commit -m 'Switch on the leaderboard' && git push"
