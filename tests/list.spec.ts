import { test, expect } from '@playwright/test';
// The test oracle is the app's own dataset: generated from a fixed seed, so the
// expected counts below are exact rather than "more than zero".
import { TRANSACTIONS } from '../src/data/transactions';
import { TOTAL, countShown, parseAmount, resultCount, rows, search, table } from './support/list';

const expectedCount = (predicate: (t: (typeof TRANSACTIONS)[number]) => boolean) =>
  TRANSACTIONS.filter(predicate).length;

test.describe('search', () => {
  test('is case-insensitive and ignores surrounding spaces', async ({ page }) => {
    const expected = expectedCount((t) => t.merchant === 'Biedronka');
    await page.goto('/');

    for (const query of ['biedronka', 'BIEDRONKA', '  Biedronka  ']) {
      await search(page).fill(query);
      await expect(resultCount(page), `query ${JSON.stringify(query)}`).toHaveText(`${expected} transactions`);
    }
  });

  test('matches on category, not only merchant', async ({ page }) => {
    // "Subscriptions" is a category and appears in no merchant name or note.
    const expected = expectedCount((t) => t.category === 'Subscriptions');
    await page.goto('/');

    await search(page).fill('subscriptions');

    await expect(resultCount(page)).toHaveText(`${expected} transactions`);
    const categories = await rows(page).locator('.col-category').allTextContents();
    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories)).toEqual(new Set(['Subscriptions']));
  });

  test('matches on notes', async ({ page }) => {
    const target = TRANSACTIONS[1234];
    const authCode = target.notes.split('·')[1].trim(); // "auth #123456"
    const expected = expectedCount((t) => t.notes.toLowerCase().includes(authCode.toLowerCase()));
    await page.goto('/');

    await search(page).fill(authCode);

    await expect(resultCount(page)).toHaveText(`${expected} transaction${expected === 1 ? '' : 's'}`);
    await expect(rows(page).filter({ hasText: target.notes })).toHaveCount(1);
  });

  test('typing key by key ends on the same result as pasting', async ({ page }) => {
    // The list renders from useDeferredValue. Each keystroke can interrupt the
    // render started by the previous one; the result must still converge on
    // the final query, not on an intermediate prefix such as "bie".
    const expected = expectedCount((t) => t.merchant === 'Biedronka');
    await page.goto('/');

    await search(page).pressSequentially('biedronka', { delay: 20 });

    await expect(search(page)).toHaveValue('biedronka');
    await expect(resultCount(page)).toHaveText(`${expected} transactions`);
    for (const text of await rows(page).allTextContents()) {
      expect(text.toLowerCase()).toContain('biedronka');
    }
  });
});

test.describe('ordering', () => {
  for (const query of ['', 'biedronka']) {
    test(`rows are sorted by amount, largest first${query ? ` (search "${query}")` : ''}`, async ({ page }) => {
      await page.goto('/');
      if (query) {
        await search(page).fill(query);
        await expect(resultCount(page)).not.toHaveText(`${TOTAL} transactions`);
      }

      const amounts = (await rows(page).locator('.col-amount').allTextContents()).map(parseAmount);
      expect(amounts.length).toBeGreaterThan(5);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));

      // The first row is the largest amount in the whole result, not just in
      // the rendered window.
      const pool = query
        ? TRANSACTIONS.filter((t) => t.merchant.toLowerCase().includes(query))
        : TRANSACTIONS;
      expect(amounts[0]).toBe(Math.max(...pool.map((t) => t.amount)));
    });
  }
});

test.describe('virtualization', () => {
  // ~20 visible rows plus an overscan of 10 on each side. The bound is loose on
  // purpose: the point is "dozens, not thousands".
  const MAX_ROWS_IN_DOM = 60;

  test('renders a window of rows, not all 8000', async ({ page }) => {
    await page.goto('/');
    await expect(resultCount(page)).toHaveText(`${TOTAL} transactions`);

    const inDom = await rows(page).count();
    expect(inDom).toBeGreaterThan(5);
    expect(inDom).toBeLessThan(MAX_ROWS_IN_DOM);
  });

  test('scrolling to the end renders the last row and drops the first', async ({ page }) => {
    await page.goto('/');
    await expect(rows(page).first()).toHaveAttribute('data-index', '0');

    await table(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight }));

    await expect(page.locator(`.transaction-row[data-index="${TOTAL - 1}"]`)).toBeVisible();
    await expect(page.locator('.transaction-row[data-index="0"]')).toHaveCount(0);
    expect(await rows(page).count()).toBeLessThan(MAX_ROWS_IN_DOM);
  });

  test('the window follows a new search back to the top', async ({ page }) => {
    await page.goto('/');
    await table(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(page.locator(`.transaction-row[data-index="${TOTAL - 1}"]`)).toBeVisible();

    // A short result list after a deep scroll: the rows must still render,
    // rather than leaving the window pointed past the end of the new list.
    await search(page).fill('subscriptions');
    await expect(resultCount(page)).not.toHaveText(`${TOTAL} transactions`);
    await expect(rows(page).first()).toBeVisible();
    const shown = await countShown(page);
    expect(await rows(page).count()).toBeLessThanOrEqual(Math.min(shown, MAX_ROWS_IN_DOM));
  });
});
