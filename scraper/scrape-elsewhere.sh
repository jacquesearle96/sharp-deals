#!/usr/bin/env bash
# Scrapes the stores whose sites refuse GitHub's servers (see SCRAPED_ELSEWHERE in the scrape workflow) and pushes
# their results to the data-elsewhere branch. A Claude Code scheduled task runs this twice a day.
# The GitHub scrape merges that branch in before every run, so this never writes the data branch itself.
#
# Usage, from the repository: scraper/scrape-elsewhere.sh
# Exit code: 0 when every store scraped, 1 when one failed (its previous results are kept), 2 on a setup problem.
set -euo pipefail

STORES="checkers foodlovers"
BRANCH=data-elsewhere
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DATA="$ROOT/app/public/data"
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

# Node's fetch ignores HTTPS_PROXY unless asked; cloud sessions send all traffic through a proxy.
export NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1

echo "== Installing the scraper"
(cd scraper && npm ci --silent --no-audit --no-fund) || exit 2

echo "== Restoring the latest data"
rm -rf "$DATA" && mkdir -p "$DATA"
git fetch -q --depth=1 origin data || exit 2
git archive FETCH_HEAD | tar -x -C "$DATA"
# Our own last results can be newer than the data branch (the GitHub scrape applies them only when it runs).
if git fetch -q --depth=1 origin "$BRANCH" 2>/dev/null; then
  mkdir -p "$OUT/last" && git archive FETCH_HEAD | tar -x -C "$OUT/last"
  (cd scraper && node src/elsewhere.ts apply "$OUT/last" "$DATA")
fi

echo "== Scraping $STORES"
status=0
(cd scraper && node src/run.ts $STORES) || status=1

echo "== Pushing the results to $BRANCH"
(cd scraper && node src/elsewhere.ts pack "$DATA" "$OUT/pack" $STORES)
cd "$OUT/pack"
git init -q -b "$BRANCH"
git config user.name "sharp-deals-bot"
git config user.email "sharp-deals-bot@users.noreply.github.com"
git add -A
git commit -q -m "Elsewhere scrape $(date -u +'%Y-%m-%d %H:%M') UTC"
git push -q -f "$(git -C "$ROOT" remote get-url origin)" "$BRANCH" || exit 2

echo "== Summary"
cat runs.json | node -e 'for (const r of JSON.parse(require("fs").readFileSync(0,"utf8"))) console.log(`${r.store}: ${r.count} products, data from ${r.at}${r.error ? `, LATEST ATTEMPT FAILED: ${r.error}` : ""}`)'
exit $status
