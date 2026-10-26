import type { Page } from 'playwright';

/** Problems noticed while scraping, collected per store and saved in runs.json so they can be read without the logs. */
let current: string[] = [];

export const note = (message: string) => {
  console.warn(`note: ${message}`);
  if (current.length < 8) current.push(message.slice(0, 300));
};

/** Returns the notes gathered since the last call and starts a fresh list. */
export function takeNotes(): string[] {
  const out = current;
  current = [];
  return out;
}

/** A short description of what a page actually shows, e.g. a "Just a moment..." challenge or a 403. */
export async function describePage(page: Page): Promise<string> {
  const title = await page.title().catch(() => '?');
  const body = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 120);
  return `title "${title}" at ${page.url().slice(0, 90)}; text: ${body}`;
}
