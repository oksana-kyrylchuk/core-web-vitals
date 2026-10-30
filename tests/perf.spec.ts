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
      firstInput: { name: string; duration: number }[];
    };
  }
}

/** Record LCP candidates, layout shifts and event timings from page start. */
async function observe(page: Page) {
  await page.addInitScript(() => {
    window.__perf = { lcp: [], shifts: [], events: [], firstInput: [] };
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

    // 'event' entries only exist for interactions of 16 ms or more, so on a
    // fast machine there may be none at all. 'first-input' is always reported,
    // which proves the measurement is wired up.
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perf.firstInput.push({ name: e.name, duration: e.duration });
    }).observe({ type: 'first-input', buffered: true });
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

    // LCP entries are delivered asynchronously after the paint; poll for one.
    await expect.poll(async () => (await perf(page)).lcp.length).toBeGreaterThan(0);
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
    // Wait for the response itself. The first version pushed sizes from an
    // async 'response' handler, so the assertion could run before the body had
    // been read: on a GitHub runner it saw zero responses and passed on retry.
    const isHero = (url: string) => /hero-\d+\.jpg$/.test(url);
    const heroResponse = page.waitForResponse((res) => isHero(res.url()));
    await page.goto('/');
    const body = await (await heroResponse).body();

    expect(body.length).toBeLessThan(200_000);
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

  // Nothing should visibly move. Where the Inter webfont loads, swapping it in
  // (display=swap) nudges text widths by a few hundredths of a pixel: 0.00003
  // measured on a Mac. A budget of 0.001 lets that through and still fails
  // loudly on a real shift: the banner outgrowing its slot was 0.016.
  const CLS_BUDGET = 0.001;
  const total = (shifts: { value: number }[]) => shifts.reduce((sum, s) => sum + s.value, 0);

  test('nothing visibly shifts while the banner and the chart arrive', async ({ page }) => {
    const shifts = await settledShifts(page);
    expect(total(shifts), `layout shifts: ${JSON.stringify(shifts)}`).toBeLessThan(CLS_BUDGET);
  });

  test('nothing visibly shifts at 320 CSS px either', async ({ page }) => {
    // The banner wraps onto more lines the narrower the screen, so a reserve
    // that fits one width can be too small for another.
    await page.setViewportSize({ width: 320, height: 640 });
    const shifts = await settledShifts(page);
    expect(total(shifts), `layout shifts: ${JSON.stringify(shifts)}`).toBeLessThan(CLS_BUDGET);
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

    const { events, firstInput } = await perf(page);
    expect(firstInput, 'first-input entry (Event Timing is being recorded)').toHaveLength(1);

    // No 'event' entries means every interaction took under 16 ms: a pass,
    // not a broken measurement. That is what a fast Mac reports here.
    const byInteraction = new Map<number, number>();
    for (const e of events) byInteraction.set(e.interactionId, Math.max(byInteraction.get(e.interactionId) ?? 0, e.duration));
    const worst = Math.max(0, ...byInteraction.values());

    test.info().annotations.push({
      type: 'INP (worst interaction)',
      description: byInteraction.size ? `${worst} ms` : 'every interaction under 16 ms',
    });
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

    // Vite references the lazy chunk relative to the entry: "./SpendingChart-<hash>.js".
    const chartChunk = main.match(/SpendingChart-[\w-]+\.js/)?.[0];
    expect(chartChunk, 'main chunk references the lazy chart chunk').toBeTruthy();
    expect(await (await request.get(new URL(chartChunk!, new URL(entry!, 'http://x')).pathname)).text()).toContain('recharts-');
  });
});
