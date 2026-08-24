# Ledger — perf lab

A small React + TypeScript finance-dashboard app, built for Week 1 of the
learning plan. It's intentionally broken from a Core Web Vitals standpoint —
several realistic performance issues are seeded into it so you have a real
before/after story instead of measuring a page you don't control.

It also previews some patterns (large lists, a chart, async data) you'll
meet again in the "Ledger" flagship project in weeks 2–6.

## Setup

```bash
npm install
npm run build
npm run preview
```

Open the printed local URL (e.g. `http://localhost:4173`).

**Measure against the production build (`build` + `preview`), not `npm run
dev`** — dev mode skips minification/bundling optimizations and will give
you misleading numbers.

## How to measure

Pick whichever you're most comfortable with:

- **Chrome DevTools → Lighthouse tab**, run on the preview URL. Do this in
  an Incognito window with no extensions, to avoid noise.
- **Chrome DevTools → Performance tab**, record a reload, and separately
  record while typing in the search box — this is where you'll see INP-style
  long tasks most clearly.
- CLI: `npx unlighthouse --site http://localhost:4173` or
  `npx lighthouse http://localhost:4173 --view` for a saved report.

Record LCP, INP, CLS, and TTFB before you change anything. Screenshot or
save the report — that's the "before" half of Friday's write-up.

## What to do

1. **Diagnose first.** Use the Performance panel and Lighthouse's
   opportunities/diagnostics to find *why* each metric is bad, not just that
   it's bad. Try to name the offending component before fixing it.
2. **Fix incrementally**, re-measuring after each change so you know which
   fix moved which number.
3. When you think you've found everything, open `SOLUTIONS.md` to compare
   notes against what was deliberately seeded — it's a self-check, not a
   starting point.
4. Write up before/after numbers + what you changed. That's Friday's
   deliverable.

## Scope note

This app deliberately only covers Week 1 (Core Web Vitals + Playwright
basics). It's plain Vite + React, not Next.js — the App Router/SSR/RSC work
starts in Week 2 on a separate project.
