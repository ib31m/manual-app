// Lightweight test runner: bundles the smoke tests with esbuild and runs them
// under Node. No test framework needed — assertions live in the test files.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const OUT = new URL('../.smoke/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const tests = [
  { name: 'domain', entry: 'scripts/smoke.ts', external: false },
  { name: 'render', entry: 'scripts/render-smoke.tsx', external: true },
];

let failed = false;
for (const t of tests) {
  const outfile = `${OUT}${t.name}.mjs`;
  console.log(`\n▶ ${t.name} (${t.entry})`);
  await build({
    entryPoints: [t.entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    outfile,
    logLevel: 'warning',
    // The render test needs react/react-dom resolved by Node (kept external).
    packages: t.external ? 'external' : undefined,
  });
  try {
    execFileSync('node', [outfile], { stdio: 'inherit' });
  } catch {
    failed = true;
  }
}

rmSync(OUT, { recursive: true, force: true });
if (failed) {
  console.error('\n✗ Some tests failed');
  process.exit(1);
}
console.log('\n✓ All smoke tests passed');
