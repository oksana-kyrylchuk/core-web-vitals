/**
 * Summary statistics shared by measure.mjs and backfill-medians.mjs.
 *
 * A series is summarised by the median of each metric taken separately, not by
 * the metrics of one "median run": the run with the median score can carry the
 * second-highest TBT of the series, and then a table of "medians" is really a
 * table of one run per series.
 */

export const METRIC_KEYS = ['score', 'fcp', 'lcp', 'tbt', 'cls', 'si', 'ttfb'];

export function median(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function mediansOf(allRuns) {
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, median(allRuns.map((r) => r?.[k]))]));
}
