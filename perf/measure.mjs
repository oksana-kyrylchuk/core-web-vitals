/**
 * Scripted Lighthouse runs for the perf lab.
 *
 *   npm run perf -- baseline            # label this measurement "baseline"
 *   npm run perf -- step-1-hero         # after the hero-image fix
 *   npm run perf -- --table             # just reprint the comparison table
 *
 * Options:
 *   --url <url>     what to measure          (default http://localhost:4173)
 *   --runs <n>      runs to take a median of (default 3)
 *   --desktop       desktop preset           (default: mobile, same as DevTools)
 *   --table         print the table, measure nothing
 *
 * Each measurement writes:
 *   perf/runs/<label>.json              small summary, worth committing
 *   perf/reports/<label>.report.html    full Lighthouse report, gitignore it
 *
 * Measure the production build (`npm run build && npm run preview`), never
 * `npm run dev`.
 */

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.join(HERE, 'runs');
const REPORTS_DIR = path.join(HERE, 'reports');

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const args = { label: null, url: 'http://localhost:4173', runs: 3, desktop: false, tableOnly: false };

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--url') args.url = argv[++i];
  else if (a === '--runs') args.runs = Number(argv[++i]);
  else if (a === '--desktop') args.desktop = true;
  else if (a === '--table') args.tableOnly = true;
  else if (a === '--help' || a === '-h') { console.log(helpText()); process.exit(0); }
  else if (a.startsWith('--')) { console.error(`Unknown option: ${a}\n${helpText()}`); process.exit(1); }
  else args.label = a;
}

if (!Number.isInteger(args.runs) || args.runs < 1) {
  console.error('--runs must be a positive integer');
  process.exit(1);
}

function helpText() {
  return [
    'Usage: npm run perf -- <label> [--url <url>] [--runs <n>] [--desktop]',
    '       npm run perf -- --table',
  ].join('\n');
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '');
}

/* --------------------------------------------------------------- presets */

// Mobile is Lighthouse's default (slow 4G, 4x CPU slowdown) and matches what
// the DevTools Lighthouse tab does out of the box. Every series in perf/runs/
// was taken with this preset — changing it invalidates the comparison.
const DESKTOP_PRESET = {
  formFactor: 'desktop',
  screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
  throttling: {
    rttMs: 40,
    throughputKbps: 10 * 1024,
    cpuSlowdownMultiplier: 1,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
  },
};

/* --------------------------------------------------------------- metrics */

const METRICS = [
  { key: 'score', label: 'Score', better: 'up', format: (v) => String(Math.round(v)) },
  { key: 'fcp', label: 'FCP', better: 'down', format: (v) => `${(v / 1000).toFixed(1)}s` },
  { key: 'lcp', label: 'LCP', better: 'down', format: (v) => `${(v / 1000).toFixed(1)}s` },
  { key: 'tbt', label: 'TBT', better: 'down', format: (v) => `${Math.round(v)}ms` },
  { key: 'cls', label: 'CLS', better: 'down', format: (v) => v.toFixed(3) },
  { key: 'si', label: 'SI', better: 'down', format: (v) => `${(v / 1000).toFixed(1)}s` },
  { key: 'ttfb', label: 'TTFB', better: 'down', format: (v) => `${Math.round(v)}ms` },
];

function extract(lhr) {
  const n = (id) => lhr.audits?.[id]?.numericValue ?? null;
  return {
    score: (lhr.categories?.performance?.score ?? 0) * 100,
    fcp: n('first-contentful-paint'),
    lcp: n('largest-contentful-paint'),
    tbt: n('total-blocking-time'),
    cls: n('cumulative-layout-shift'),
    si: n('speed-index'),
    ttfb: n('server-response-time'),
  };
}

/* ------------------------------------------------------------ preflight */

async function assertServerUp(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const why = err.name === 'AbortError' ? 'no response in 5s' : err.message;
    console.error(
      `\n  Can't reach ${url} — ${why}.\n\n` +
      `  Start the production preview in another terminal first:\n\n` +
      `      npm run build && npm run preview\n\n` +
      `  Then re-run. (A Lighthouse run against a dead URL is what produces\n` +
      `  those useless "chromewebdata" reports.)\n`
    );
    process.exit(1);
  }
}

/* ---------------------------------------------------------------- measure */

async function measure() {
  const label = slug(args.label ?? `run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`);
  const preset = args.desktop ? 'desktop' : 'mobile';

  await assertServerUp(args.url);
  await mkdir(RUNS_DIR, { recursive: true });
  await mkdir(REPORTS_DIR, { recursive: true });

  console.log(`\n  ${label} — ${args.url} (${preset}, median of ${args.runs})\n`);

  let chrome;
  const results = [];
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: [
        '--headless=new',
        '--disable-extensions',
        '--disable-features=Translate',
        '--no-first-run',
        // escape hatch, e.g. PERF_CHROME_FLAGS="--no-sandbox" for CI containers
        ...(process.env.PERF_CHROME_FLAGS ?? '').split(' ').filter(Boolean),
      ],
    });

    for (let i = 1; i <= args.runs; i++) {
      process.stdout.write(`    run ${i}/${args.runs} … `);
      const flags = {
        port: chrome.port,
        logLevel: 'error',
        output: ['json', 'html'],
        onlyCategories: ['performance'],
        ...(args.desktop ? DESKTOP_PRESET : {}),
      };
      const runnerResult = await lighthouse(args.url, flags);
      if (!runnerResult) throw new Error('Lighthouse returned no result');

      const { lhr, report } = runnerResult;
      if (lhr.runtimeError) throw new Error(lhr.runtimeError.message);

      const metrics = extract(lhr);
      results.push({ metrics, html: Array.isArray(report) ? report[1] : report });
      console.log(`score ${Math.round(metrics.score)}, LCP ${(metrics.lcp / 1000).toFixed(1)}s`);
    }
  } catch (err) {
    console.error(`\n  Lighthouse failed: ${err.message}\n`);
    if (/ChromeLauncher|Chrome/i.test(err.message)) {
      console.error('  If Chrome could not be found, point CHROME_PATH at it, e.g.\n' +
        '    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run perf -- ' + label + '\n');
    }
    process.exitCode = 1;
    return;
  } finally {
    if (chrome) await chrome.kill();
  }

  // Median run, picked by performance score — one bad run can't skew the record.
  const sorted = [...results].sort((a, b) => a.metrics.score - b.metrics.score);
  const median = sorted[Math.floor(sorted.length / 2)];

  const summary = {
    label,
    url: args.url,
    preset,
    savedAt: new Date().toISOString(),
    runs: results.length,
    metrics: median.metrics,
    allScores: results.map((r) => Math.round(r.metrics.score)),
    allRuns: results.map((r) => r.metrics),
  };

  const jsonPath = path.join(RUNS_DIR, `${label}.json`);
  const htmlPath = path.join(REPORTS_DIR, `${label}.report.html`);
  await writeFile(jsonPath, JSON.stringify(summary, null, 2) + '\n');
  await writeFile(htmlPath, median.html);

  const spread = Math.max(...summary.allScores) - Math.min(...summary.allScores);
  console.log(`\n    saved  perf/runs/${label}.json`);
  console.log(`           perf/reports/${label}.report.html`);
  if (spread > 5) {
    console.log(`\n    note: scores ranged ${summary.allScores.join('/')} — ${spread} points of noise.`);
    console.log(`          Close other apps, or raise --runs, before trusting a small delta.`);
  }
}

/* ------------------------------------------------------------------ table */

async function loadRuns() {
  let files = [];
  try {
    files = (await readdir(RUNS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const rows = [];
  for (const f of files) {
    try {
      rows.push(JSON.parse(await readFile(path.join(RUNS_DIR, f), 'utf8')));
    } catch {
      console.error(`    (skipped unreadable ${f})`);
    }
  }
  return rows.filter((r) => r.metrics).sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
}

function pad(s, w, right = false) {
  return right ? String(s).padStart(w) : String(s).padEnd(w);
}

async function printTable() {
  const runs = await loadRuns();
  const rows = runs;

  if (rows.length === 0) {
    console.log('\n  No measurements yet. Run:  npm run perf -- baseline\n');
    return;
  }

  const cells = rows.map((r) => ({
    label: r.label,
    values: METRICS.map((m) => {
      const v = r.metrics?.[m.key];
      return v == null ? '—' : m.format(v);
    }),
  }));

  const labelW = Math.max(...cells.map((c) => c.label.length), 'Measurement'.length);
  const colW = METRICS.map((m, i) => Math.max(m.label.length, ...cells.map((c) => c.values[i].length)));

  const line = (l, vals) => `  ${pad(l, labelW)}  ${vals.map((v, i) => pad(v, colW[i], true)).join('  ')}`;

  console.log('');
  console.log(line('Measurement', METRICS.map((m) => m.label)));
  console.log(`  ${'-'.repeat(labelW)}  ${colW.map((w) => '-'.repeat(w)).join('  ')}`);
  for (const c of cells) console.log(line(c.label, c.values));

  // Where the latest run stands against the first measurement.
  if (rows.length > 1) {
    const first = runs[0] ?? rows[0];
    const last = rows[rows.length - 1];
    const deltas = METRICS.map((m) => {
      const a = first.metrics?.[m.key];
      const b = last.metrics?.[m.key];
      if (a == null || b == null) return null;
      const diff = b - a;
      if (Math.abs(diff) < 1e-9) return `${m.label} unchanged`;
      const improved = m.better === 'up' ? diff > 0 : diff < 0;
      // Sign follows the metric itself; the word says whether that's good news.
      const size = m.key === 'cls' ? Math.abs(diff).toFixed(3)
        : m.key === 'score' ? String(Math.round(Math.abs(diff)))
        : m.key === 'tbt' || m.key === 'ttfb' ? `${Math.round(Math.abs(diff))}ms`
        : `${(Math.abs(diff) / 1000).toFixed(1)}s`;
      return `${m.label} ${diff > 0 ? '+' : '-'}${size} (${improved ? 'better' : 'worse'})`;
    }).filter(Boolean);

    console.log(`\n  ${last.label} vs ${first.label}:`);
    console.log(`    ${deltas.join(' · ')}`);
  }

  console.log('\n  INP is not in this table: a Lighthouse navigation never interacts with');
  console.log('  the page. It is measured by hand in the Performance panel while typing');
  console.log('  in the search field — see the INP files in perf/runs/.\n');
}

/* ------------------------------------------------------------------- main */

if (!args.tableOnly) await measure();
await printTable();
