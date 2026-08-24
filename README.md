# ledger-lite-perf-lab

A small React + TypeScript finance dashboard used as a controlled environment
for measuring and fixing Core Web Vitals. Performance problems are built in
deliberately, so each fix can be measured in isolation against a stable baseline.

## Baseline — 22 Aug 2026

| Metric | Target           | Before   |
|---|------------------|----------|
| Performance score | 100              | 58       |
| FCP | $\le$ 1.8 s      | 3.2 s    |
| LCP | $\le$ 2.5 s      | 3.6 s    |  
| TBT | $\le$ 200ms      | 1,350 ms |
| CLS | $\le$ 0.1  | 0.023    |
| Speed Index | $\le$ 3.4s       | 3.4 s    |

Full report: `perf/before.report.html`

## Method

Measured against the production build, not the dev server:

npm install && npm run build && npm run preview

Lighthouse run in Incognito with no extensions. INP measured separately in the
Performance panel while typing in the search field, since a cold Lighthouse run
doesn't capture interaction latency.

## Results

In progress. After-numbers and the commit behind each fix land here at end of week.