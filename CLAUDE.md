# Sharp Deals

Personal app comparing South African grocery and baby-shop specials. README.md covers setup and how it runs; this file
is the short version for working on the code.

## Layout

- `app/` React + Vite PWA, published to GitHub Pages. Reads only `data/index.json`, `shop-index.json`, `runs.json`, `history/`.
- `scraper/` one adapter per store in `src/stores/`; `src/run.ts` runs them and builds the indexes.
- `shared/` types and logic used by both (promo parsing, store switches).

## Commands

```
cd app && npx vitest run --root ..     # all tests (app, scraper, shared)
cd app && npm run build                # type-check and build
cd scraper && node src/run.ts <store>  # scrape one store into app/public/data (gitignored)
```

To try the app on real data: `git fetch origin data && git archive FETCH_HEAD | tar -x -C app/public/data`,
then `cd scraper && node src/run.ts index` to rebuild the indexes.

## Where data lives

- `data` branch: the latest store files, runs and price history. Only the `scrape-and-deploy.yml` workflow writes it.
- `data-elsewhere` branch: results for stores whose sites refuse GitHub's servers (Checkers and Food Lover's, via
  cataloguespecials.co.za). A Claude Code scheduled task, "Scrape Checkers and Food Lover's" (05:41 and 17:41 UTC, Haiku),
  runs `scraper/scrape-elsewhere.sh`, which force-pushes this branch. The workflow copies it into the data at the start of
  every run (`scraper/src/elsewhere.ts apply`) and skips those stores itself (`SCRAPED_ELSEWHERE`).
- Neither data branch is ever merged into main.

## Rules for changes

- **Merge code changes into main.** The scheduled task and the workflows run whatever is on main, so a change to the
  scraper (especially `leaflet.ts`, `run.ts`, `elsewhere.ts` or `scrape-elsewhere.sh`) does nothing until it is merged.
  After merging such a change, check the task's next run.
- Moving a store between GitHub and the scheduled task means changing both `SCRAPED_ELSEWHERE` in the workflow and
  `STORES` in `scrape-elsewhere.sh`.
- Scrapers identify themselves (`UA` in `scraper/src/http.ts`), wait between requests and follow robots.txt.
  When a site blocks us, don't work around the block (no browser user agents, stealth or proxy services); find another
  allowed source or run from a network the site serves.
- A failing store keeps its previous data; the app says how old it is. Keep that behaviour.
- In Claude Code cloud sessions, Node's `fetch` needs `NODE_USE_ENV_PROXY=1` to go through the session's proxy
  (`scrape-elsewhere.sh` sets it).
