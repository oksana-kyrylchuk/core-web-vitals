import { test, expect, type Page, type Request } from '@playwright/test';

const chartHeading = (page: Page) => page.getByRole('heading', { name: 'Spending by category' });
const chartSection = (page: Page) => page.locator('section.chart-section');
const isChartChunk = (req: Request) => /\/assets\/SpendingChart-[\w-]+\.js$/.test(req.url());

// 10 categories in the dataset, one bar each.
const CATEGORY_COUNT = 10;

test.describe('lazy chart', () => {
  test('the chart chunk is not requested until the chart nears the viewport', async ({ page, isMobile }) => {
    // On the 412x823 mobile viewport the placeholder starts ~70px below the
    // fold, inside the observer's 200px rootMargin, so the chunk is requested
    // right after first paint. That is the documented behaviour (README, fix
    // 4b), and the next test covers it. Here the placeholder is well below the
    // fold, which is the case the IntersectionObserver gate exists for.
    test.skip(isMobile, 'placeholder starts inside the rootMargin on this viewport');

    const chunkRequests: string[] = [];
    page.on('request', (req) => {
      if (isChartChunk(req)) chunkRequests.push(req.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(chunkRequests, 'chart chunk fetched before scrolling').toEqual([]);
    await expect(chartSection(page)).toHaveAttribute('aria-busy', 'true');

    const chunk = page.waitForRequest(isChartChunk);
    await chartHeading(page).scrollIntoViewIfNeeded();
    await chunk;

    await expect(chartSection(page)).not.toHaveAttribute('aria-busy');
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(CATEGORY_COUNT);
    expect(chunkRequests).toHaveLength(1);
  });

  test('on mobile the chart loads without scrolling', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only behaviour');

    await page.goto('/');

    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(CATEGORY_COUNT);
  });

  test('swapping the placeholder for the chart does not change the section height', async ({ page, isMobile }) => {
    // The placeholder repeats the chart's geometry so that the chart arriving
    // cannot shift anything (fix 4a/4b). Compare the box before and after.
    test.skip(isMobile, 'the chart replaces the placeholder right after first paint here, so there is no stable "before"');
    await page.goto('/');
    await expect(chartSection(page)).toHaveAttribute('aria-busy', 'true');
    const before = await chartSection(page).boundingBox();

    await chartHeading(page).scrollIntoViewIfNeeded();
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(CATEGORY_COUNT);
    const after = await chartSection(page).boundingBox();

    expect(after!.height).toBeCloseTo(before!.height, 0);
  });
});
