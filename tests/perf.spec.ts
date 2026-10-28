import { test, expect, type Page } from '@playwright/test';

/*
 * Guards for the Track A fixes. Lighthouse measures them (perf/runs/); these
 * tests keep them from quietly regressing. Each one asserts the mechanism a
 * fix put in place, plus the metric where a browser can report it directly.
 *
 * Numbers from a test machine are not the README's numbers: CPU, network and
 * throttling differ. The thresholds are the Core Web Vitals "good" limits,
 * which the app should meet with room to spare.
 */

declare global {
  interface Window {
    __perf: {
      lcp: { element: string; url: string; startTime: number }[];
      shifts: { value: number; sources: string[]; hadRecentInput: boolean }[];
      events: { interactionId: number; name: string; duration: number }[];
    };
  }
}

/** Record LCP candidates, layout shifts and event timings from page start. */
async function observe(page: Page) {
  await page.addInitScript(() => {
    window.__perf = { lcp: [], shifts: [], events: [] };
    const describe = (n: Node | null | undefined) =>
      n instanceof Element ? `${n.tagName.toLowerCase()}${n.className ? '.' + String(n.className).split(' ')[0] : ''}` : String(n);

    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceEntry[] & { element?: Element; url?: string }[]) {
        const entry = e as PerformanceEntry & { element?: Element; url?: string };
        window.__perf.lcp.push({ element: describe(entry.element), url: entry.url ?? '', startTime: entry.startTime });
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] };
        window.__perf.shifts.push({
          value: shift.value,
          hadRecentInput: shift.hadRecentInput,
          sources: (shift.sources ?? []).map((s) => describe(s.node)),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const ev = e as PerformanceEntry & { interactionId?: number };
        if (ev.interactionId) window.__perf.events.push({ interactionId: ev.interactionId, name: ev.name, duration: ev.duration });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
}

const perf = (page: Page) => page.evaluate(() => window.__perf);

test.describe('LCP: the hero image', () => {
  test('is the LCP element, served locally, fetched once and eagerly', async ({ page, baseURL }) => {
    const heroRequests: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'image' && /hero/.test(req.url())) heroRequests.push(req.url());
    });
    await observe(page);
    await page.goto('/');
    await expect(page.getByRole('img', { name: 'Dashboard overview' })).toBeVisible();
    await page.waitForLoadState('load');

    const { lcp } = await perf(page);
    const last = lcp.at(-1)!;
    expect(last.element, 'LCP element').toBe('img.hero-image');
    expect(last.url.startsWith(baseURL!), `LCP image is first-party: ${last.url}`).toBe(true);

    // The preload and the <img> must resolve to the same srcset candidate,
    // or the browser downloads the hero twice.
    expect(heroRequests, 'hero image requests').toHaveLength(1);
  });

  test('keeps the markup the fix depends on', async ({ page }) => {
    await page.goto('/');
    const img = page.getByRole('img', { name: 'Dashboard overview' });

    await expect(img).not.toHaveAttribute('loading', 'lazy');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
    const srcset = await img.getAttribute('srcset');

    const preload = page.locator('link[rel="preload"][as="image"]');
    await expect(preload).toHaveCount(1);
    await expect(preload).toHaveAttribute('imagesrcset', srcset!);
    await expect(preload).toHaveAttribute('imagesizes', (await img.getAttribute('sizes'))!);
  });

  test('the image this viewport downloads stays under 200 kB', async ({ page }) => {
    const sizes: number[] = [];
    page.on('response', async (res) => {
      if (/hero-\d+\.jpg$/.test(res.url())) sizes.push((await res.body()).length);
    });
    await page.goto('/');
    await page.waitForLoadState('load');

    expect(sizes).toHaveLength(1);
    expect(sizes[0]).toBeLessThan(200_000);
  });
});

test.describe('CLS', () => {
  async function settledShifts(page: Page) {
    await observe(page);
    await page.goto('/');
    // Wait past the banner (mounts at 1.8 s), then bring the chart in, so the
    // two late arrivals on this page have both happened.
    await expect(page.getByRole('button', { name: 'Upgrade' })).toBeVisible();
    await page.getByRole('heading', { name: 'Spending by category' }).scrollIntoViewIfNeeded();
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(10);
    await page.waitForTimeout(500); // let the last layout-shift entries flush
    return (await perf(page)).shifts.filter((s) => !s.hadRecentInput);
  }

  test('nothing shifts while the banner and the chart arrive', async ({ page }) => {
    const shifts = await settledShifts(page);
    expect(shifts, 'layout shifts (value and the nodes that moved)').toEqual([]);
  });

  test('nothing shifts at 320 CSS px either', async ({ page }) => {
    // The banner wraps onto more lines the narrower the screen, so a reserve
    // that fits one width can be too small for another.
    await page.setViewportSize({ width: 320, height: 640 });
    const shifts = await settledShifts(page);
    expect(shifts).toEqual([]);
  });
});

test.describe('INP', () => {
  test('typing a search stays under 200 ms per interaction at 4x CPU slowdown', async ({ page, isMobile }) => {
    // Same conditions as the hand measurements in perf/runs/inp-manual.json:
    // 4x CPU slowdown, typing "biedronka" at a normal pace. The hand-measured
    // worst interaction after the fixes was 51 ms; before them, 1352 ms.
    test.skip(isMobile, 'one CPU-throttled run is enough; the work does not depend on the viewport');
    await observe(page);
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('8000 transactions');

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.getByRole('textbox', { name: 'Search transactions' }).pressSequentially('biedronka', { delay: 120 });
    await expect(page.getByRole('status')).not.toHaveText('8000 transactions');
    await page.waitForTimeout(500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const { events } = await perf(page);
    const byInteraction = new Map<number, number>();
    for (const e of events) byInteraction.set(e.interactionId, Math.max(byInteraction.get(e.interactionId) ?? 0, e.duration));
    const worst = Math.max(0, ...byInteraction.values());

    test.info().annotations.push({ type: 'INP (worst interaction, ms)', description: String(worst) });
    expect(byInteraction.size, 'interactions observed').toBeGreaterThan(0);
    expect(worst).toBeLessThan(200);
  });
});

test.describe('bundle', () => {
  test('the initial chunk stays small and does not contain the chart library', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const entry = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
    expect(entry, 'entry script in index.html').toBeTruthy();

    const main = await (await request.get(entry!)).text();
    // 221 kB today (React, the data generator, the list); recharts alone is 358 kB.
    expect(main.length).toBeLessThan(250_000);
    // recharts tags its DOM with "recharts-" class names; the main chunk must
    // not contain them, the lazy chart chunk must.
    expect(main).not.toContain('recharts-');

    const chartChunk = main.match(/assets\/SpendingChart-[\w-]+\.js/)?.[0];
    expect(chartChunk, 'main chunk references the lazy chart chunk').toBeTruthy();
    expect(await (await request.get('/' + chartChunk)).text()).toContain('recharts-');
  });
});
