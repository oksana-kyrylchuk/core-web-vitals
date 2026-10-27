import { test, expect, type Page } from '@playwright/test';

const TOTAL = 8000;

// The transaction rows are plain <div>s with no list or table semantics, so
// there is no role to query them by. CSS is the only handle for now; giving
// the list real semantics is part of the accessibility session (B3), and these
// locators should move to getByRole when it does.
const rows = (page: Page) => page.locator('.transaction-row');

// Matches "8000 transactions", "152 transactions", "0 transactions".
const resultCount = (page: Page) => page.getByText(/^\d+ transactions$/);

async function countShown(page: Page) {
  const text = await resultCount(page).textContent();
  return Number(text?.match(/^(\d+)/)?.[1]);
}

test.describe('smoke', () => {
  test('renders the page shell without console errors', async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      // A failed request to a third party (the Google Fonts stylesheet) is the
      // network's problem, not the app's, and must not make this test flaky.
      // Errors raised by the app's own origin still count.
      const source = msg.location().url;
      if (source && baseURL && !source.startsWith(baseURL)) return;
      errors.push(`${msg.text()} (${source || 'no source'})`);
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    await expect(page).toHaveTitle('Ledger — perf lab');
    await expect(page.getByRole('heading', { level: 1, name: 'Ledger' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Dashboard overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spending by category' })).toBeAttached();

    expect(errors).toEqual([]);
  });

  test('shows every transaction before a search', async ({ page }) => {
    await page.goto('/');

    await expect(resultCount(page)).toHaveText(`${TOTAL} transactions`);
    await expect(rows(page).first()).toBeVisible();
  });

  test('search narrows the list to matching rows', async ({ page }) => {
    await page.goto('/');
    // The input has no <label>; its accessible name comes from the placeholder,
    // which is a fallback rather than a label. Flagged for B3.
    const search = page.getByRole('textbox', { name: /search merchant, category, or notes/i });

    await search.fill('biedronka');

    // The list renders from a deferred value, so the count settles a moment
    // after the input changes; toHaveText retries until it does.
    await expect(resultCount(page)).not.toHaveText(`${TOTAL} transactions`);
    const shown = await countShown(page);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(TOTAL);

    // Search matches merchant, category or notes, so check the whole row text.
    const texts = await rows(page).allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text.toLowerCase()).toContain('biedronka');
  });

  test('a search with no matches shows zero rows', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: /search merchant/i }).fill('no-such-merchant-xyz');

    await expect(resultCount(page)).toHaveText('0 transactions');
    await expect(rows(page)).toHaveCount(0);
  });

  test('clearing the search restores the full list', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('textbox', { name: /search merchant/i });

    await search.fill('biedronka');
    await expect(resultCount(page)).not.toHaveText(`${TOTAL} transactions`);

    await search.clear();
    await expect(resultCount(page)).toHaveText(`${TOTAL} transactions`);
  });
});
