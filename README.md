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

## PS5 tab (temporary, Black Friday 2026)

The **PS5** tab lists every PlayStation 5 console from Takealot, Amazon.co.za, Game, Makro, Incredible, HiFi Corp,
BT Games, Loot, House & Home, OK Furniture and Computer Mania, cheapest first. The `ps5.yml` workflow refreshes it
every hour during November only. To refresh on demand, tap **Refresh** on the PS5 tab: it reloads the latest prices,
and once GitHub is connected in **Settings** it also starts a fresh check of every store (about 5 minutes). Without a
token, **Actions > PS5 prices > Run workflow** does the same. Checkers is not
included: its site blocks automated requests. To run it locally: `cd scraper && node src/ps5/run.ts [store ...]`.

To remove it afterwards, delete `shared/ps5.ts`, `shared/ps5.test.ts`, `scraper/src/ps5/`,
`app/src/components/Ps5Deals.tsx` and `.github/workflows/ps5.yml`, then remove the lines marked `TEMPORARY` in
`app/src/App.tsx`, `app/src/components/BottomNav.tsx` and `app/src/components/Settings.tsx` (the PS5 stores
section), delete `app/src/lib/ps5Feed.ts`, and remove the `ps5.json` exception in `scrape-and-deploy.yml`.

## Settings tab

- **Appearance**: light, dark, or follow the phone.
- **Toolbar**: hide tabs you don't use (Settings always stays).
- **Shared list**: create a shared list code or join your partner's.
- **Grocery & baby stores** and **PS5 stores**: how each store did on its latest run, with a switch to stop scraping it.
  A store that is off is skipped by the workflow and its prices are hidden from the app. The switches save to the
  repository variables `GROCERY_STORES_OFF` and `PS5_STORES_OFF` (space-separated store ids), which you can also edit
  under **Settings > Secrets and variables > Actions > Variables**. **Run now** starts that scrape straight away.
- **GitHub access**: the switches and Run now need a
  [fine-grained token](https://github.com/settings/personal-access-tokens/new) limited to this repository with
  **Actions** and **Variables** set to Read and write. It is kept in that browser only, never in the site.

## Installing on an iPhone

Open the Pages address in **Safari**, tap **Share**, then **Add to Home Screen**.

## If a store stops working

Open the failed run in **Actions** and read the **Scrape** step. Each store logs its own error. The app keeps
showing that store's last good data, and **Settings** shows when each store last updated and why its latest run failed.
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
