import { test, expect } from '@playwright/test';
import { TOTAL, countShown, resultCount, rows, search } from './support/list';

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

    await search(page).fill('biedronka');

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
    await search(page).fill('no-such-merchant-xyz');

    await expect(resultCount(page)).toHaveText('0 transactions');
    await expect(rows(page)).toHaveCount(0);
  });

  test('clearing the search restores the full list', async ({ page }) => {
    await page.goto('/');

    await search(page).fill('biedronka');
    await expect(resultCount(page)).not.toHaveText(`${TOTAL} transactions`);

    await search(page).clear();
    await expect(resultCount(page)).toHaveText(`${TOTAL} transactions`);
  });
});
