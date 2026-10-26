# Sharp Deals

One place to search specials from Checkers, Pick n Pay, Woolworths, Food Lover's Market, Spar, Clicks, Dis-Chem,
Baby City and Babies R Us, plus a Baby and Tech section for Black Friday. Built as an installable web app (PWA).

- `app/` the web app (React, Vite, Tailwind)
- `scraper/` the scrapers, one adapter per store (Node and Playwright)
- `shared/` code used by both (promo parsing, types)
- `supabase/` the database setup for the shared shopping list

## How it runs

A GitHub Actions workflow (`scrape-and-deploy.yml`) runs every 6 hours:

1. restores the previous data and price history from the `data` branch,
2. scrapes every store (a store that fails keeps its last good data),
3. saves the new data to the `data` branch (a single commit, so the repo does not grow),
4. builds the app and publishes it to GitHub Pages.

Price history builds up run by run. Verdict tags such as "Lowest in 20 days" appear after about a week.

## One-time setup

1. **Create the repository.** On github.com click **New repository**, name it `sharp-deals`, set it to **Public**
   (free GitHub Pages and unlimited Actions minutes need a public repo), and do not add a README.
2. **Push the code** (see the commands at the end).
3. **Turn on Pages.** Repository **Settings > Pages > Build and deployment > Source: GitHub Actions**.
4. **Shared list (optional).** Repository **Settings > Secrets and variables > Actions > Variables tab >
   New repository variable**, add both:
   - `VITE_SUPABASE_URL` = your project URL, e.g. `https://abcd1234.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your `sb_publishable_...` key (safe to be public; never use the Secret key)

   The Supabase project itself is set up as described in `supabase/README.md`.
5. **First run.** Repository **Actions > Scrape and deploy > Run workflow**. It takes about 1 to 1.5 hours.
   When it finishes, the app is at `https://<your-github-username>.github.io/sharp-deals/`.

### Starting a run by pushing a tag

Besides the Actions page, pushing a git tag named `scrape-<stores>` starts a run, with the store names joined by dashes:

```
git tag scrape-foodlovers-checkers && git push origin scrape-foodlovers-checkers
git tag scrape-all && git push origin scrape-all        # everything
git push origin :refs/tags/scrape-all                   # delete the tag afterwards so the name can be reused
```

## Installing on an iPhone

Open the Pages address in **Safari**, tap **Share**, then **Add to Home Screen**.

## If a store stops working

Open the failed run in **Actions** and read the **Scrape** step. Each store logs its own error. The app keeps
showing that store's last good data, and **Data status** (bottom of the Deals tab) shows when each store last updated.
Some sites block cloud servers; if that happens to one store you can run its scraper on your own PC instead
(`cd scraper && node src/run.ts <store>`), then push the result to the `data` branch.

## Notes

- GitHub pauses scheduled workflows after 60 days with no repository activity. Any commit, or pressing **Run workflow**, restarts them.
- Checkers and Food Lover's Market specials come from the leaflet site cataloguespecials.co.za, whose terms reserve rights to its data.
- Scrapers only read public pages, wait between requests, and skip any area a site's robots.txt asks crawlers to avoid.

## Working on it locally

```
cd scraper && npm ci && npx playwright install chromium
cd ../app && npm ci
node ../scraper/src/run.ts pnp spar   # scrape some stores (or "grocery", "shop", or nothing for all)
npm run dev                            # http://localhost:5173
npx vitest run --root ..               # tests
```

`node src/run.ts index` rebuilds the indexes from the data already on disk.

## Pushing the code (step 2)

Replace `YOUR-USERNAME` with your GitHub username:

```
git remote add origin https://github.com/YOUR-USERNAME/sharp-deals.git
git push -u origin main
```

The first push opens a browser window to sign in to GitHub.
