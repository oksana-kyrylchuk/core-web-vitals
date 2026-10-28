# Core Web Vitals

A small React + TypeScript finance dashboard used as a controlled environment
for measuring and fixing Core Web Vitals. The performance problems are built in
on purpose, so each fix can be measured on its own against a stable baseline.

Every number in this file comes from a committed file in `perf/runs/`. Each
Lighthouse figure is the median of 9 runs, taken per metric. INP is measured by
hand and reported separately.

## Results

Lighthouse mobile preset, production build, median of 9 runs per series.

| Metric | Target | Before · 7 Sep | After · 10 Sep | Range before | Range after |
|---|---|---|---|---|---|
| Performance score | 100 | 51 | **99** | 51–62 | 99–99 |
| LCP | ≤ 2.5 s | 5.49 s | **1.75 s** ¹ | 3.61–5.50 s | 1.75–1.77 s |
| TBT (lab proxy for INP) | ≤ 200 ms | 1484 ms | **23 ms** | 1224–1536 ms | 4–35 ms |
| CLS | ≤ 0.1 | 0.023 | **0.016** ¹ | constant | constant |
| FCP | ≤ 1.8 s | 2.10 s | **1.65 s** ¹ | 2.10–2.79 s | 1.65–1.66 s |
| Speed Index | ≤ 3.4 s | 3.00 s | **1.65 s** | 2.93–3.55 s | 1.65–1.66 s |
| **INP** (manual, worst of 3 loads) | ≤ 200 ms | 1352 ms | **51 ms** | 1208–1352 ms | 44–51 ms |

¹ The last fix (virtualization) changed the page's layout, so LCP, FCP and CLS
after it are not directly comparable with earlier series (see
[known issues](#known-issues)). Measured just before it, on the pre-virtualization
layout, they were **LCP 1.59 s, FCP 1.51 s, CLS 0**. TBT and INP are
comparable across all series.

The before and after distributions don't overlap for TBT, INP or LCP, so those
improvements are well outside run-to-run noise.

### Every series

| Series | Commit | Score | FCP | LCP · range | TBT · range | CLS |
|---|---|---|---|---|---|---|
| `baseline` | [`1296a46`][1296a46] | 51 | 2.10 s | 5.49 s · 3.61–5.50 | 1484 ms · 1224–1536 | 0.023 |
| `step-1-fonts` | [`8bdf2ae`][8bdf2ae] | 60 | 2.10 s | 3.90 s · 3.54–5.35 | 1362 ms · 1112–1607 | 0.023 ² |
| `step-2-hero` | [`bbc5b24`][bbc5b24] | 70 | 2.10 s | 2.47 s · 2.46–3.64 | 1335 ms · 1236–1724 | 0.023 |
| `step-3-cls` | [`fddc452`][fddc452] | 71 | 2.10 s | 2.46 s · 2.39–2.48 | 1281 ms · 1225–1378 | 0 |
| `step-3-cls-bundle` | [`769e7ae`][769e7ae] | 68 | 2.37 s | 3.31 s · 3.19–3.77 | 944 ms · 151–1363 | 0 |
| `step-3b-lazy-on-visible` | [`b748b79`][b748b79] | 74 | 1.51 s | 1.58 s · 1.58–1.73 | 1356 ms · 1243–1818 | 0 |
| `step-4a-merchant-map` | [`21569ab`][21569ab] | 77 | 1.51 s | 1.59 s · 1.58–1.73 | 1015 ms · 896–1561 | 0 |
| `step-4-inp` | [`cf032d5`][cf032d5] | 99 | 1.65 s | 1.75 s · 1.75–1.77 | 23 ms · 4–35 | 0.016 |

² One run of the nine reported CLS 0.604. It did not recur in the 54 committed runs
that followed and was not explained.

INP, by hand, worst of three page loads at each step
(`perf/runs/inp-manual.json`):

| State | Commit | Three loads | INP |
|---|---|---|---|
| untouched app | [`ab5ec18`][ab5ec18] | 1248 / 1208 / 1352 | 1352 ms |
| start of the INP work (after the LCP, CLS and bundle fixes) | [`b748b79`][b748b79] | 945 / 986 / 1014 | 1014 ms |
| merchant-frequency map | [`21569ab`][21569ab] | 697 / 721 / 760 | 760 ms |
| + `useMemo` on filter and sort | — ³ | 742 / 758 / 808 | 808 ms |
| + `useDeferredValue` | [`554f2b5`][554f2b5] | 4650 / 5350 / 5589 | **5589 ms** |
| + virtualized rows | [`cf032d5`][cf032d5] | 44 / 45 / 51 | 51 ms |

³ `useMemo` was measured on its own but committed together with
`useDeferredValue`. The drop from 1352 to 1014 ms between the first two rows
is not attributed to any fix: none of those changes targeted interaction cost,
and the two were measured on different days.

## The fixes

### 1 · Fonts — [`8bdf2ae`][8bdf2ae]

`@import` inside `App.css` hid the font request behind a parse of the
stylesheet itself (HTML → CSS → font CSS → woff2), and `display=block` kept
text invisible until the font arrived. Replaced with `preconnect` to both font
origins and a `<link>` in `<head>` with `display=swap`.

The median LCP moved 5.49 → 3.90 s, but **this is mostly an artifact**. LCP
on this page was bimodal (see [below](#why-medians-and-ranges)), and the font
fix moved neither mode. It changed the mix from 4 fast runs in 9 to 6 in 9,
so the median landed in the other cluster. What did move consistently: the
slow mode dropped from about 5.49–5.50 s to 5.35 s in every slow run.

### 2 · Hero image — [`bbc5b24`][bbc5b24]

The hero was the LCP element and had four problems at once:

- it came from `picsum.photos`, which answers **302** to
  `fastly.picsum.photos`, so the critical path carried a redirect across two
  third-party origins;
- `loading="lazy"` on an element above the fold;
- one 402 300-byte file;
- 2000 px wide for a slot that is never wider than 960 CSS px.

Replaced with two local files behind `srcset`/`sizes`, preloaded with a
matching `imagesrcset` so the preload and the `<img>` resolve to the same URL.
The mobile viewport now gets 122 127 bytes, and a retina desktop 357 317.

This tested the hypothesis recorded with the baseline: **the slow LCP mode
disappeared entirely.** Seven of nine runs now land within 30 ms of each other
(2.46–2.49 s). The two remaining runs at 3.61–3.64 s also have a late FCP
(3.2 s against 2.1 s): first paint itself was late, upstream of the image.

### 3 · Layout shift — [`fddc452`][fddc452]

`PromoBanner` returned `null` for 1.8 s and then mounted above `<main>`,
pushing the list down. That was the project's only lab layout shift: one entry,
CLS 0.02297574136399017, identical to 17 decimal places across 27 runs in three
series. The container now renders from the first paint and reserves its height.
**CLS 0.023 → 0 in all nine runs.**

The `aspect-ratio` on the hero (fix 2) was the right change, but it addressed a
shift this lab run never measured, so the number did not move then.

### 4 · Bundle, in two steps — [`769e7ae`][769e7ae], [`b748b79`][b748b79]

`recharts` was imported statically for a chart below the fold, so the main
chunk was 551 442 bytes (163 034 gzip) and the build warned about a chunk over
500 kB.

**Step a, `React.lazy`: made the page slower.** The main chunk dropped to
195 701 bytes (61 863 gzip), the warning disappeared, and LCP got **851 ms
worse** (2.46 → 3.31 s; the distributions don't overlap). `React.lazy` starts
the import when the component renders, and the component is in the tree from
the first render. So a 102 843-byte chunk was requested at 328 ms at High
priority, ahead of the hero image at Low. The bytes left the parse path and
moved into the network path, in front of the LCP element.

**Step b, load on visibility.** The import is now gated on an
`IntersectionObserver` around a placeholder with the same geometry. LCP
2.46 → 1.58 s and FCP 2.10 → 1.51 s, both measured against the state before
any bundle work. The chunk is still downloaded during the Lighthouse run (the
placeholder sits within the 200 px root margin), just after paint instead of
before it. Nothing was hidden from the metric; the bytes were moved off the
critical path.

### 5 · Interaction — [`21569ab`][21569ab], [`554f2b5`][554f2b5], [`cf032d5`][cf032d5]

Every keystroke filtered and sorted 8000 rows. Then, for each row,
`scoreTransaction` scanned all 8000 again — O(n²) — and every row was a real
DOM node.

- **Merchant-frequency map.** Counted once at module level instead of per
  row. INP 1014 → 760 ms. TBT 1356 → 1015 ms (permutation test on the medians,
  p = 0.024).
- **`useMemo`** on filter and sort: 760 → 808 ms. The samples overlap, so no
  measurable change, as expected for a list that changes on every keystroke.
- **`useDeferredValue`: 808 → 5589 ms, a 7× regression.** Deferring doesn't
  remove work, it lowers its priority. Each keystroke started a low-priority
  render of up to 8000 rows, the next keystroke invalidated it, and the starved
  work was eventually flushed synchronously: 4.79 s of processing inside one
  interaction. Kept as its own commit on purpose.
- **Virtualization** (`@tanstack/react-virtual`): about 20 rows in the DOM
  instead of up to 8000. TBT 1015 → 23 ms, INP 5589 → 51 ms. This is also
  what makes the previous step pay off: with 20 rows, the deferred render
  finishes between keystrokes instead of restarting.

The order in the original plan was "decouple the input, then virtualize". It
was wrong. `useDeferredValue` is a scheduling tool, not an optimization: it
helps only once the deferred work is small enough to finish between keystrokes.

## TBT and INP are different numbers

TBT is a lab metric from a page load: the main-thread time over 50 ms per
task, between first paint and interactivity. Nobody types during a Lighthouse
run. INP is the latency of real interactions, here typing in the search field.
TBT is used as a proxy because it can be scripted. But it moved the wrong way
when FCP got earlier (fix 4b: FCP 600 ms earlier, so the TBT window got 600 ms
longer). It also says nothing about the `useDeferredValue` regression, which
only exists while someone is typing. That is why INP is measured separately.

## Why medians and ranges

The same untouched build scored 45 and 62 on consecutive single runs. At
baseline, LCP was bimodal rather than noisy: four runs at 3.61–3.88 s and five
at 5.49–5.50 s, with nothing in between. Two single runs taken before the
harness existed each landed in a different mode:

| Measurement | Score | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| 22 Aug, single run | 50 | 2.17 s | 5.54 s | 1613 ms | 0.023 |
| 24 Aug, single run | 58 | 3.25 s | 3.59 s | 1348 ms | 0.023 |
| 7 Sep, median of 9 | 51 | 2.10 s | 5.49 s | 1484 ms | 0.023 |

Both single runs are committed (`perf/runs/before-2026-08-22.json`,
`perf/lighthouse-before.report.json`). They are kept as evidence, but the
comparison table never gives a single run a row.

The noise floor also showed up directly. Two full series on byte-identical
code produced LCP medians of 1581 and 1729 ms (the median landed in a different
cluster) and TBT of 1356 and 1276 ms. So a TBT change of around 100 ms between
two series means nothing here unless the distributions separate.

## Checked against the answer key

The project came with a `SOLUTIONS.md` listing the seeded problems. I opened it
only after the fixes were measured.

- **Found independently: all of them.** Lazy-loaded, oversized hero with no
  preload or priority; no reserved space for the hero or the banner;
  `@import` + `display=block` font; filter + sort on every keystroke; O(n²)
  scoring; no virtualization; eager `recharts`.
- **One deliberate divergence.** The key suggests debouncing the input. I used
  `useDeferredValue` instead of a fixed delay. The measurements above show it
  only pays off after virtualization.
- **Not in the key:**
  - the third-party 302 behind the bimodal LCP;
  - `React.lazy` making LCP worse by fetching at render time;
  - the `useDeferredValue` regression;
  - CLS 0.023 being a single shift caused by the banner alone.

## Known issues

- **CLS is 0.016 after virtualization, not 0.** Absolutely positioned rows no
  longer give the page its intrinsic width, so on the 412 px mobile viewport
  `.app` is now actually narrow. The banner text wraps there and outgrows its
  51 px reserve. The `layout-shifts` audit attributes the whole 0.016 to
  `<main>`. Before this, `white-space: nowrap` rows kept the layout about
  830 px wide on every viewport, so the earlier "mobile" series measured a
  desktop-width layout on a mobile CPU and network.
- **`toLocaleString` with options on every row** builds a new number formatter
  on each call. Virtualization hid the cost but did not remove it.
- **A forced reflow** flagged by DevTools in the baseline recording was never
  investigated.
- **Late-painting runs.** In three of the first five series, some runs had a
  first paint at 3.2 s against 2.1 s. These runs did not follow any change made
  to the page, and the cause is unknown. They disappear from fix 3b onward.

## What I would do differently

- **Unique labels for every series from day one.** An early baseline series
  that reported CLS 0.601 was overwritten by a later series with the same label.
  The evidence for the largest anomaly in the project is gone.
- **Summarize by per-metric medians from the start.** The harness first stored
  the full metric set of the run with the median *score*, and the README called
  that "median of 9". Corrected in `fix(perf): summarise a series by the median of each metric`. No conclusion changed,
  but the recharts regression was understated (732 ms instead of 851).
- **Measure each technique on its own before combining them.** Written together,
  `useDeferredValue` and virtualization gave 34–53 ms, and the deferred value
  looked like part of the win. Measured separately, it was a 7× regression.
- **Make sure the code under test actually changed.** The first hour of the
  INP work measured a fix that had not been written yet. The by-product was the
  noise-floor series above.
- **Build from a clean clone before calling it done.** Virtualization was
  committed without its dependency in `package.json` and built only because
  the package was already in `node_modules`. Fixed in `fix: declare @tanstack/react-virtual as a dependency`.
- **Fix the layout before measuring.** The horizontal overflow on mobile was
  left alone to keep the series comparable. When virtualization fixed it as a
  side effect, it broke comparability anyway, at the end.

## Tests

End-to-end tests run with Playwright against the same production build the
measurements use (`npm run build && npm run preview`, started by Playwright's
`webServer`). Two projects: desktop Chrome, and a mobile profile matching the
Lighthouse mobile emulation (412×823, DPR 1.75).

```
npx playwright install chromium   # once
npm run test:e2e
npm run test:e2e:ui               # watch mode with the trace viewer
```

What the suite covers (`tests/`):

- **smoke** — the page shell renders with no errors from the app's own origin;
  the full list shows 8000 transactions; search narrows, empties and restores it.
- **search** — case-insensitive, ignores surrounding spaces, matches category
  and notes as well as merchant, and typing key by key converges on the same
  result as pasting (the list renders from `useDeferredValue`). Expected counts
  come from the app's own seeded dataset, so they are exact.
- **ordering** — rows are sorted by amount, largest first, with and without a
  search, and the first row is the largest amount in the whole result.
- **virtualization** — dozens of rows in the DOM, not 8000; scrolling to the end
  renders row 7999 and drops row 0; a new search after a deep scroll still
  renders from the top.
- **lazy chart** — on desktop the chart chunk is not requested until the chart
  nears the viewport, and the placeholder and the chart have the same height.
  On the mobile viewport the placeholder starts inside the 200 px root margin,
  so the chart loads without scrolling; that is tested as its own case.

Each group was checked the other way round: disabling virtualization, reversing
the sort, loading the chart eagerly or dropping category from the search makes
the matching tests fail. The suite also found a bug: one result was shown as
"1 transactions".

## Method

Production build, never the dev server:

```
npm ci
npm run build
npm run preview                      # terminal 1
npm run perf -- <label> --runs 9     # terminal 2
npm run perf -- --table
```

- Lighthouse 13.4.1 (pinned in devDependencies), default mobile preset:
  simulated slow 4G, 4× CPU slowdown.
- HeadlessChrome 152, launched by `chrome-launcher`, no extensions, on an
  otherwise idle Mac. The Chrome version is recorded in the HTML reports,
  not in `perf/runs/`.
- 9 runs per series, with the same preset and run count for every series.
- `perf/runs/<label>.json` keeps every run (`allRuns`) and the per-metric
  `medians` that the tables use. Full HTML reports go to `perf/reports/` and
  are gitignored.
- INP: Chrome DevTools Performance panel, CPU 4× + Slow 4G, typing
  "biedronka" into the search field, worst interaction per page load, three
  loads per step. Cross-checked with a `PerformanceObserver` on `event`
  entries.

[1296a46]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/1296a46
[ab5ec18]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/ab5ec18
[8bdf2ae]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/8bdf2ae
[bbc5b24]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/bbc5b24
[fddc452]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/fddc452
[769e7ae]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/769e7ae
[b748b79]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/b748b79
[21569ab]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/21569ab
[554f2b5]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/554f2b5
[cf032d5]: https://github.com/oksana-kyrylchuk/core-web-vitals/commit/cf032d5
