// Captures a Hacker News thread from all three sources into a test fixture:
//   - expected: HN's own rendered order ([id, depth, state] rows, all comment pages)
//   - algolia:  the Algolia item tree (text reduced to a presence marker to keep fixtures small)
//   - firebase: every Firebase item reachable from the story via `kids`
//
// Usage: node scripts/capture-fixture.mjs <storyId> <name>

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HN = 'https://news.ycombinator.com';
const ALGOLIA = 'https://hn.algolia.com/api/v1';
const FIREBASE = 'https://hacker-news.firebaseio.com/v0';
const CONCURRENCY = 32;

const [storyIdArg, name] = process.argv.slice(2);
if (!storyIdArg || !name) {
    process.stderr.write('Usage: node scripts/capture-fixture.mjs <storyId> <name>\n');
    process.exit(1);
}
const storyId = Number(storyIdArg);

async function getText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'dusk-fixture-capture' } });
    if (!res.ok) {
        throw new Error(`${res.status} ${url}`);
    }
    return res.text();
}

async function getJson(url) {
    return JSON.parse(await getText(url));
}

// Row states as HN renders them for logged-out readers: heavily flagged comments start collapsed
// ("coll") and their replies are present but hidden ("noshow") until expanded.
function parseHnRows(html) {
    const rows = [];
    for (const match of html.matchAll(/<tr class=["']athing comtr([^"']*)["'] id=["'](\d+)["']/g)) {
        const depth = Number(/indent=["'](\d+)["']/.exec(html.slice(match.index, match.index + 3000))?.[1]);
        const classes = match[1].trim().split(/\s+/);
        let state = 'open';
        if (classes.includes('coll')) {
            state = 'collapsed';
        } else if (classes.includes('noshow')) {
            state = 'hidden';
        }
        rows.push([Number(match[2]), depth, state]);
    }
    const moreTag = /<a\b[^>]*\bclass=["']morelink["'][^>]*>/.exec(html)?.[0];
    const moreHref = moreTag ? /href=["']([^"']+)["']/.exec(moreTag)?.[1] : undefined;
    return { rows, next: moreHref ? `${HN}/${moreHref.replaceAll('&amp;', '&')}` : null };
}

async function captureHn() {
    const rows = [];
    let url = `${HN}/item?id=${storyId}`;
    let pages = 0;
    while (url) {
        const page = parseHnRows(await getText(url));
        rows.push(...page.rows);
        url = page.next;
        pages += 1;
    }
    return { rows, pages };
}

function trimText(text) {
    if (text === null || text === undefined) {
        return null;
    }
    // HN replaces the text of heavily flagged comments with this marker and hides their subtree.
    return text === '[flagged]' ? text : 'x';
}

function trimAlgolia(node) {
    return {
        id: node.id,
        type: node.type,
        author: node.author ?? null,
        text: trimText(node.text),
        created_at_i: node.created_at_i,
        parent_id: node.parent_id ?? null,
        children: (node.children ?? []).map(trimAlgolia),
    };
}

async function captureFirebase() {
    const items = {};
    let frontier = [storyId];
    while (frontier.length > 0) {
        const next = [];
        for (let i = 0; i < frontier.length; i += CONCURRENCY) {
            const batch = frontier.slice(i, i + CONCURRENCY);
            const results = await Promise.all(batch.map((id) => getJson(`${FIREBASE}/item/${id}.json`)));
            for (const item of results) {
                if (!item) {
                    continue;
                }
                const trimmed = { id: item.id, type: item.type, time: item.time };
                for (const key of ['by', 'parent', 'kids', 'deleted', 'dead', 'descendants']) {
                    if (item[key] !== undefined) {
                        trimmed[key] = item[key];
                    }
                }
                if (item.text !== undefined) {
                    trimmed.text = trimText(item.text);
                }
                items[item.id] = trimmed;
                next.push(...(item.kids ?? []));
            }
        }
        frontier = next;
    }
    return items;
}

const hn = await captureHn();
const algolia = trimAlgolia(await getJson(`${ALGOLIA}/items/${storyId}`));
const firebase = await captureFirebase();

const fixture = {
    storyId,
    capturedAt: new Date().toISOString(),
    hnPages: hn.pages,
    expected: hn.rows,
    algolia,
    firebase,
};

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'fixtures', `${name}.json`);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(fixture)}\n`);
process.stdout.write(`${name}: story ${storyId}, ${hn.rows.length} HN rows over ${hn.pages} page(s), ${Object.keys(firebase).length} Firebase items\n`);
