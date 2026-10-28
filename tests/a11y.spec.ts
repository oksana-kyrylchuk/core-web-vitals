import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TOTAL, resultCount, rows, search, table } from './support/list';

const upgrade = (page: Page) => page.getByRole('button', { name: 'Upgrade' });
const chart = (page: Page) => page.getByRole('application', { name: 'Spending by category' });
const chartHeading = (page: Page) => page.getByRole('heading', { name: 'Spending by category' });

/** The page as a user ends up seeing it: banner mounted, chart loaded. */
async function loadEverything(page: Page) {
  await page.goto('/');
  await expect(upgrade(page)).toBeVisible(); // the banner mounts after 1.8 s
  await chartHeading(page).scrollIntoViewIfNeeded();
  await expect(chart(page)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
}

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

// The app has one dark design, but the operating system's light/dark setting
// still reached it through leftover template CSS: in light mode the chart
// heading was 1.03:1. Scan under both settings.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${colorScheme} color scheme`, () => {
    test.use({ colorScheme });

    test('no WCAG 2.2 AA or best-practice violations', async ({ page }) => {
      await loadEverything(page);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      // Readable failure: rule id and the elements, not a 2000-line JSON dump.
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  });
}

test.describe('semantics axe cannot check', () => {
  test('the list is a table with headers, and says how big it really is', async ({ page }) => {
    await page.goto('/');

    await expect(table(page).getByRole('columnheader')).toHaveText([
      'Date', 'Merchant', 'Category', 'Notes', 'Seen', 'Amount',
    ]);
    await expect(table(page).getByRole('columnheader', { name: 'Amount' })).toHaveAttribute('aria-sort', 'descending');

    // Only ~20 rows exist in the DOM; aria-rowcount and aria-rowindex let a
    // screen reader say "row 2 of 8001" instead of "row 2 of 23".
    await expect(table(page)).toHaveAttribute('aria-rowcount', String(TOTAL + 1));
    const first = rows(page).first();
    await expect(first).toHaveAttribute('aria-rowindex', '2');
    await expect(first.getByRole('cell')).toHaveCount(6);

    await search(page).fill('subscriptions');
    await expect(resultCount(page)).not.toHaveText(`${TOTAL} transactions`);
    const shown = Number((await resultCount(page).textContent())!.match(/\d+/)![0]);
    await expect(table(page)).toHaveAttribute('aria-rowcount', String(shown + 1));
  });

  test('rendered rows carry their position in the full list', async ({ page }) => {
    await page.goto('/');
    await table(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight }));

    const last = page.locator(`[data-index="${TOTAL - 1}"]`);
    await expect(last).toBeVisible();
    await expect(last).toHaveAttribute('aria-rowindex', String(TOTAL + 1));
  });

  test('the search box has a real label, and the count is announced', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel('Search transactions')).toBeEditable();
    await expect(resultCount(page)).toHaveText(`${TOTAL} transactions`);
  });

  test('the promotion is a labelled landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('complementary', { name: 'Promotion' })).toContainText('Go Premium');
  });

  test('the chart has a name and its figures as a table', async ({ page }) => {
    await loadEverything(page);

    const figures = page.getByRole('table', { name: 'Total spending by category, in US dollars' });
    // 10 categories + the header row.
    await expect(figures.getByRole('row')).toHaveCount(11);
    await expect(figures.getByRole('rowheader', { name: 'Groceries' })).toBeAttached();
  });
});

test.describe('keyboard', () => {
  async function expectFocusVisible(target: Locator) {
    await expect(target).toBeFocused();
    const outline = await target.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style, 'focus outline style').not.toBe('none');
    expect(outline.width, 'focus outline width').toBeGreaterThanOrEqual(2);
  }

  test('Tab reaches every control in order, each with a visible focus ring', async ({ page }) => {
    await loadEverything(page);

    await page.keyboard.press('Tab');
    await expectFocusVisible(upgrade(page));
    await page.keyboard.press('Tab');
    await expectFocusVisible(search(page));
    await page.keyboard.press('Tab');
    await expectFocusVisible(table(page));
    await page.keyboard.press('Tab');
    await expectFocusVisible(chart(page));

    // And back out again: no focus trap anywhere on the way.
    await page.keyboard.press('Shift+Tab');
    await expect(table(page)).toBeFocused();
  });

  test('search and scrolling work without a mouse', async ({ page }) => {
    await page.goto('/');
    await expect(upgrade(page)).toBeVisible();

    await page.keyboard.press('Tab'); // Upgrade
    await page.keyboard.press('Tab'); // search
    await page.keyboard.type('biedronka');
    await expect(resultCount(page)).not.toHaveText(`${TOTAL} transactions`);

    await page.keyboard.press('Tab'); // the table
    await expect(table(page)).toBeFocused();
    await page.keyboard.press('End');
    const shown = Number((await resultCount(page).textContent())!.match(/\d+/)![0]);
    await expect(page.locator(`[data-index="${shown - 1}"]`)).toBeVisible();
  });
});

test.describe('reflow (WCAG 1.4.10)', () => {
  test('nothing but the table scrolls sideways at 320 CSS px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await loadEverything(page);

    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
    // The search box stays usable rather than being squeezed by the count.
    expect((await search(page).boundingBox())!.width).toBeGreaterThan(200);
  });
});
