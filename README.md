# Core Web Vitals

A small React + TypeScript finance dashboard used as a controlled environment
for measuring and fixing Core Web Vitals. Performance problems are built in
deliberately, so each fix can be measured in isolation against a stable baseline.

## Baseline — 7 Sep 2026

Median of 9 Lighthouse runs against the production build. Every run's metrics
are committed in `perf/runs/baseline.json`.

| Metric | Target | Before (median of 9) | Range across the 9 runs |
|---|---|---|---|
| Performance score | 100 | 51 | 51–62 |
| FCP | ≤ 1.8 s | 2.10 s | 2.10–2.79 s |
| LCP | ≤ 2.5 s | 5.50 s | 3.61–5.50 s |
| TBT | ≤ 200 ms | 1524 ms | 1224–1536 ms |
| CLS | ≤ 0.1 | 0.023 | no variation |
| Speed Index | ≤ 3.4 s | 2.93 s | 2.93–3.55 s |

### Why a median, and why the range column

LCP here is bimodal rather than noisy: four runs land at 3.61–3.88 s and five at
5.49–5.50 s, with no values in between. Two earlier single runs of the same
untouched code each landed in a different mode:

| Measurement | Score | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| 22 Aug, single run | 50 | 2.17 s | 5.55 s | 1613 ms | 0.023 |
| 24 Aug, single run | 58 | 3.25 s | 3.59 s | 1348 ms | 0.023 |
| 7 Sep, median of 9 | 51 | 2.10 s | 5.50 s | 1524 ms | 0.023 |

A single Lighthouse run reports one of the two modes and says nothing about the
other — which is why an earlier version of this README claimed an LCP of 3.6 s.

The suspected cause is visible in the report's network table: `picsum.photos`
answers 302 to `fastly.picsum.photos`, and the 402 KB hero image arrives over
that second origin, while carrying `loading="lazy"` despite sitting above the
fold. The fixes that follow remove the third-party hop. If the hypothesis holds,
LCP should collapse into a single state — that is the check, not the raw delta.

CLS is identical to 17 decimal places across all 9 runs.

## Method

Production build, never the dev server:

```
npm ci
npm run build
npm run preview                      # terminal 1
npm run perf -- baseline --runs 9    # terminal 2
npm run perf -- --table
```

- Lighthouse 13.4.1, default mobile preset (simulated slow 4G, 4x CPU slowdown)
- HeadlessChrome 152, launched by `chrome-launcher`, no extensions
- 9 runs per measurement on an otherwise idle machine. The same preset and run
  count are used for every measurement, so the before/after table compares like
  with like.
- Summaries land in `perf/runs/`, are committed, and are the source of every
  number in this file. Full HTML reports go to `perf/reports/` and are ignored.
- The single run from 24 Aug is kept as `perf/lighthouse-before.report.json`.

INP is deliberately absent from the tables above. A Lighthouse navigation never
interacts with the page, so it reports Total Blocking Time instead. TBT is used
here as the lab proxy; INP is measured by hand in the Performance panel while
typing in the search field, and the two are reported as separate numbers.

## Results

In progress. After-numbers and the commit behind each fix land here at end of week.
