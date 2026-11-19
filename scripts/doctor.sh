#!/usr/bin/env bash
# Checks that this machine can run Peak Finder. Safe to run any time; changes nothing.
set -u
ok=1
say() { printf '%-34s %s\n' "$1" "$2"; }
need_ver() { # name, have, want_major
  local major="${2%%.*}"
  if [ -n "$2" ] && [ "$major" -ge "$3" ] 2>/dev/null; then say "$1" "ok ($2)"; else say "$1" "MISSING or too old (have '${2:-none}', need >= $3)"; ok=0; fi
}
node_v=$(node -v 2>/dev/null | sed 's/^v//')
need_ver "Node (app)" "${node_v:-}" 22
npm_v=$(npm -v 2>/dev/null)
need_ver "npm (app)" "${npm_v:-}" 10
py_v=$(python3 -c 'import sys;print("%d.%d"%sys.version_info[:2])' 2>/dev/null)
if [ -n "${py_v:-}" ] && python3 -c 'import sys;sys.exit(0 if sys.version_info>=(3,9) else 1)'; then say "Python (fake data script)" "ok ($py_v)"; else say "Python (fake data script)" "MISSING or too old (need >= 3.9; pipeline lanes want 3.13)"; ok=0; fi
if [ -d app/node_modules ]; then say "app dependencies" "installed"; else say "app dependencies" "not installed: run  npm run setup"; fi
if [ -f .env ]; then say ".env (pipeline keys)" "present"; else say ".env (pipeline keys)" "absent (only lanes 1 and 2 need it: cp .env.example .env)"; fi
if [ -d walks/angels_landing ]; then say "3D walks" "present ($(ls walks | wc -l | tr -d ' ') walks)"; else say "3D walks" "missing (walks/ is empty)"; fi
echo
if [ "$ok" = 1 ]; then echo "Ready. Try:  npm run setup && npm run dev"; else echo "Fix the items marked MISSING, then run this again."; exit 1; fi
