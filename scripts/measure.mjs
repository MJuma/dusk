// Times Dusk against news.ycombinator.com in emulated iPhone browsers.
//
// Usage: node scripts/measure.mjs <dusk-base-url> <storyId> [runs]
//   e.g. node scripts/measure.mjs http://localhost:4173/ 50242939 3
//
// Reports, per engine, the median of `runs`:
//   - HN: time to DOMContentLoaded (the full thread is in the HTML at that point)
//   - Dusk cold: fresh profile, no cache, no service worker
//   - Dusk warm: same profile reloaded, shell served by the service worker
// Each Dusk time is measured from navigation start to the first rendered comments and to the
// complete, fully-ordered thread.

import { chromium, devices, webkit } from 'playwright-core';

const [baseUrl, storyIdArg, runsArg] = process.argv.slice(2);
if (!baseUrl || !storyIdArg) {
    process.stderr.write('Usage: node scripts/measure.mjs <dusk-base-url> <storyId> [runs]\n');
    process.exit(1);
}
const storyId = Number(storyIdArg);
const runs = Number(runsArg ?? 3);
const { defaultBrowserType: _engine, ...contextOptions } = devices['iPhone 15'];

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};
const ms = (value) => (value === undefined ? '   n/a' : `${Math.round(value).toString().padStart(5)}ms`);

async function measureHn(browser) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await page.goto(`https://news.ycombinator.com/item?id=${storyId}`, { waitUntil: 'domcontentloaded' });
    const timing = await page.evaluate(() => {
        const [nav] = performance.getEntriesByType('navigation');
        return { dcl: nav.domContentLoadedEventEnd, rows: document.querySelectorAll('tr.athing.comtr').length };
    });
    await context.close();
    return timing;
}

async function readDusk(page) {
    await page.waitForFunction(() => performance.getEntriesByName('dusk:thread-complete-render').length > 0, undefined, { timeout: 30_000 });
    return page.evaluate(() => ({
        first: performance.getEntriesByName('dusk:thread-first-render')[0]?.startTime,
        complete: performance.getEntriesByName('dusk:thread-complete-render')[0]?.startTime,
        rows: document.querySelectorAll('article.c').length,
        controlled: navigator.serviceWorker?.controller !== null && navigator.serviceWorker?.controller !== undefined,
    }));
}

async function measureDusk(browser, problems) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            problems.add(`${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => problems.add(`pageerror: ${error.message}`));
    const url = `${baseUrl}#/item/${storyId}`;

    await page.goto(url);
    const cold = await readDusk(page);
    // Playwright only supports service workers in Chromium; WebKit's "warm" run uses the HTTP cache.
    await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), undefined, { timeout: 5_000 }).catch(() => undefined);
    await page.reload();
    const warm = await readDusk(page);
    await context.close();
    return { cold, warm };
}

const results = [];
for (const { name, engine } of [{ name: 'webkit', engine: webkit }, { name: 'chromium', engine: chromium }]) {
    const browser = await engine.launch();
    const problems = new Set();
    const hn = [];
    const cold = [];
    const warm = [];
    for (let run = 0; run < runs; run++) {
        hn.push(await measureHn(browser));
        const dusk = await measureDusk(browser, problems);
        cold.push(dusk.cold);
        warm.push(dusk.warm);
    }
    await browser.close();
    results.push({ name, hn, cold, warm, problems });
}

for (const { name, hn, cold, warm, problems } of results) {
    process.stdout.write(`\n${name} (${contextOptions.viewport.width}x${contextOptions.viewport.height}), story ${storyId}, median of ${runs}\n`);
    process.stdout.write(`  HN page          DOMContentLoaded ${ms(median(hn.map((r) => r.dcl)))}   (${hn[0].rows} comments)\n`);
    process.stdout.write(`  Dusk cold        first comments ${ms(median(cold.map((r) => r.first)))}   complete ${ms(median(cold.map((r) => r.complete)))}   (${cold[0].rows} comments)\n`);
    process.stdout.write(`  Dusk warm (SW)   first comments ${ms(median(warm.map((r) => r.first)))}   complete ${ms(median(warm.map((r) => r.complete)))}   controlled=${warm.every((r) => r.controlled)}\n`);
    for (const problem of problems) {
        process.stdout.write(`  ! ${problem}\n`);
    }
}
