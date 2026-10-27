/**
 * One-off: add a `medians` field to series recorded before measure.mjs wrote
 * one. Computed from each file's own allRuns, so nothing is re-measured.
 * Files that already have `medians`, or have no allRuns, are left untouched.
 *
 *   node perf/backfill-medians.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mediansOf } from './stats.mjs';

const RUNS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runs');

for (const f of (await readdir(RUNS_DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const file = path.join(RUNS_DIR, f);
  const data = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(data.allRuns) || data.medians) {
    console.log(`  skip   ${f}`);
    continue;
  }
  // Keep key order readable: medians right after metrics.
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v;
    if (k === 'metrics') out.medians = mediansOf(data.allRuns);
  }
  await writeFile(file, JSON.stringify(out, null, 2) + '\n');
  console.log(`  filled ${f}`);
}
