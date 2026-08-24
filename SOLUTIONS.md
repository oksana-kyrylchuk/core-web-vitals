# Self-check — seeded issues

Don't open this until you've done your own diagnosis pass. It's here to
confirm you found the real causes, not to hand you the fix list up front.

## LCP — `src/components/Header.tsx`, `src/App.css`

- `loading="lazy"` on the hero image: this is very likely your LCP element,
  and lazy-loading it delays its own paint. Never lazy-load an above-the-
  fold / LCP candidate.
- The image is requested at 2000×1200 and displayed much smaller — wasted
  bytes on the critical path.
- No `fetchpriority="high"` and no `<link rel="preload">` for it.
- **Fix direction:** drop `loading="lazy"`, add `fetchpriority="high"`,
  serve/request an appropriately sized image, consider preloading it in
  `index.html`.

## CLS — `src/App.css`, `src/components/Header.tsx`, `PromoBanner.tsx`

- `.hero-image` has no `height`/`aspect-ratio`, so the page reflows once the
  image loads.
- `PromoBanner` mounts ~1.8s after first paint with no space reserved above
  it, shoving everything below it down.
- The `@import` web font has `display=block`, which (depending on how it
  resolves) can also contribute to shift/invisible-text time.
- **Fix direction:** set `aspect-ratio` (or explicit width/height) on the
  hero image; reserve a fixed-height slot for the promo banner (or animate
  it in without displacing layout); use `font-display: swap` and consider
  preloading/self-hosting the font.

## INP — `src/components/TransactionList.tsx`

- `filterAndSort` runs a filter + a fresh sort over up to 8,000 rows on
  every keystroke, synchronously, with no debounce.
- `scoreTransaction` is O(n) per row, called for every visible row on every
  render — effectively O(n²) for the whole list on each keystroke.
- The full result set is rendered as real DOM nodes — no virtualization —
  so React has thousands of nodes to reconcile after every change.
- **Fix direction:** debounce the input, memoize the filtered/sorted result
  with `useMemo`, precompute/cache the risk score instead of recomputing it
  per keystroke, and virtualize the list (e.g. `react-window` /
  `@tanstack/react-virtual`).

## Bundle size — `src/components/SpendingChart.tsx`, `src/App.tsx`

- `recharts` is imported eagerly at the top of the module graph even though
  the chart is below the fold. `npm run build` should print a "chunk larger
  than 500 kB" warning — that's this.
- **Fix direction:** `React.lazy` + `Suspense` around `SpendingChart`, so
  its code only loads once it's actually needed/visible. This is the same
  pattern you'll use for `next/dynamic` in Week 2.
