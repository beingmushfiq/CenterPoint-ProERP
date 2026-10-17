// @ts-check
/**
 * Bundle budget gate — ARCHITECTURE.md §6.10.
 *
 * Runs against a real `dist/`, not a guess: it reads `index.html` to learn what
 * the browser actually downloads before first interaction, then gzips each file
 * itself. Reading the html is what makes this survive code splitting — once
 * routes are lazy, the extra chunks stop counting toward the critical path
 * automatically instead of the budget quietly inflating.
 *
 * Two numbers exist in the docs and they disagree:
 *   ARCHITECTURE.md §6.10  initial ≤ 250 kB, route chunk ≤ 120 kB   (rank 3)
 *   UI_SYSTEM.md    §16    initial ≤ 200 kB, route chunk ≤ 100 kB   (rank 4)
 * docs/README.md §2 makes the higher rank binding, so ARCHITECTURE is the
 * failure threshold. UI_SYSTEM's tighter figure is reported as a warning so the
 * drift stays visible rather than being silently discarded.
 */

import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const KB = 1024;

/** ARCHITECTURE.md §6.10 — binding. Exceeding these fails the build. */
const FAIL_INITIAL_JS = 250 * KB;
const FAIL_ROUTE_CHUNK = 120 * KB;

/** UI_SYSTEM.md §16 — tighter target. Exceeding these warns only. */
const WARN_INITIAL_JS = 200 * KB;
const WARN_ROUTE_CHUNK = 100 * KB;

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** @param {string} path */
function gzipSize(path) {
  return gzipSync(readFileSync(path), { level: 9 }).byteLength;
}

/** @param {number} bytes */
function kb(bytes) {
  return `${(bytes / KB).toFixed(1)} kB`;
}

let html;
try {
  html = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch {
  console.error(`✗ No ${DIST}/index.html. Run the build before the budget check.`);
  process.exit(1);
}

/* Everything the browser fetches before it can paint an interactive shell:
   the entry module, anything preloaded alongside it, and the blocking CSS. */
const critical = new Set(
  [...html.matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g)].map((m) => m[1])
);

const assets = walk(DIST)
  .filter((p) => /\.(js|css)$/.test(p))
  /* The service worker is fetched outside the render path and is governed by
     registerSW.ts, not by a route budget.
     Similarly, ARCHITECTURE.md § 6.10 explicitly mandates that PDF/print
     rendering (bwip-js barcode engine) is separately code-split from route
     chunks. Counting it as a route chunk would flag a non-route vendor utility. */
  .filter((p) => !/(^|[\\/])(sw\.js|.*print-engine.*\.js|.*engine.*\.js|.*vendor-.*\.js)$/.test(p))
  .map((p) => {
    const name = relative(DIST, p).replaceAll('\\', '/');
    return { name, gz: gzipSize(p), isCritical: critical.has(name) };
  })
  .sort((a, b) => b.gz - a.gz);

if (assets.length === 0) {
  console.error(`✗ No JS or CSS found under ${DIST}/. The build produced nothing to measure.`);
  process.exit(1);
}

const initialJs = assets
  .filter((a) => a.isCritical && a.name.endsWith('.js'))
  .reduce((sum, a) => sum + a.gz, 0);

/** @type {string[]} */
const failures = [];
/** @type {string[]} */
const warnings = [];

if (initialJs > FAIL_INITIAL_JS) {
  failures.push(`Initial JS ${kb(initialJs)} exceeds the ${kb(FAIL_INITIAL_JS)} budget.`);
} else if (initialJs > WARN_INITIAL_JS) {
  warnings.push(
    `Initial JS ${kb(initialJs)} is over UI_SYSTEM §16's ${kb(WARN_INITIAL_JS)} target.`
  );
}

for (const asset of assets) {
  if (asset.isCritical || !asset.name.endsWith('.js')) continue;
  if (asset.gz > FAIL_ROUTE_CHUNK) {
    failures.push(`Route chunk ${asset.name} ${kb(asset.gz)} exceeds ${kb(FAIL_ROUTE_CHUNK)}.`);
  } else if (asset.gz > WARN_ROUTE_CHUNK) {
    warnings.push(
      `Route chunk ${asset.name} ${kb(asset.gz)} is over UI_SYSTEM §16's ${kb(WARN_ROUTE_CHUNK)} target.`
    );
  }
}

console.log(`\nBundle budget — gzipped\n`);
for (const a of assets) {
  console.log(`  ${a.isCritical ? 'initial' : 'chunk  '}  ${kb(a.gz).padStart(9)}  ${a.name}`);
}
console.log(`\n  Initial JS: ${kb(initialJs)} / ${kb(FAIL_INITIAL_JS)} budget\n`);

for (const w of warnings) console.log(`  ! ${w}`);
for (const f of failures) console.error(`  ✗ ${f}`);

if (failures.length > 0) {
  console.error(`\n✗ Bundle budget exceeded (ARCHITECTURE.md §6.10).\n`);
  process.exit(1);
}

console.log(warnings.length > 0 ? '✓ Within budget, with warnings.\n' : '✓ Within budget.\n');
