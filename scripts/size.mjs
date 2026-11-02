// Fails when the JavaScript needed for first paint (the entry chunk plus everything it imports
// statically) exceeds the budget. Lazy chunks don't count: they load on demand.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 30_000;
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const files = new Set();
for (const [, src] of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) {
    files.add(src);
}
for (const [, href] of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) {
    files.add(href);
}
if (files.size === 0) {
    process.stderr.write('size: no entry script found in dist/index.html\n');
    process.exit(1);
}

let total = 0;
for (const file of files) {
    const path = join(dist, file.slice(file.indexOf('assets/')));
    const bytes = gzipSync(readFileSync(path), { level: 9 }).length;
    total += bytes;
    process.stdout.write(`${(bytes / 1000).toFixed(2).padStart(7)} kB  ${file}\n`);
}
const headroom = BUDGET_BYTES - total;
process.stdout.write(`${(total / 1000).toFixed(2).padStart(7)} kB  first-paint JavaScript, gzipped (budget ${BUDGET_BYTES / 1000} kB, ${(headroom / 1000).toFixed(2)} kB left)\n`);
if (headroom < 0) {
    process.stderr.write('size: over budget. Move code behind a lazy import (see src/app/lazy.tsx).\n');
    process.exit(1);
}
