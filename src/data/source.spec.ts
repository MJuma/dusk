import { afterEach, describe, expect, it, vi } from 'vitest';

import { HnSource } from './source';
import type { FetchJson } from './thread.loader';

function fakeHn(size: number) {
    let ranking = Array.from({ length: size }, (_, index) => index + 1);
    const calls = { rankings: 0, items: 0 };
    const fetchJson = (async (url: string) => {
        if (url.endsWith('/topstories.json')) {
            calls.rankings += 1;
            return [...ranking];
        }
        const item = /\/item\/(\d+)\.json$/.exec(url);
        if (item) {
            calls.items += 1;
            return { id: Number(item[1]), type: 'story', title: `Story ${item[1]}`, descendants: 0 };
        }
        throw new Error(`404 ${url}`);
    }) as FetchJson;
    return {
        source: new HnSource(fetchJson),
        calls,
        rerank: (next: number[]) => {
            ranking = next;
        },
    };
}

const ids = (page: { stories: { id: number }[] }): number[] => page.stories.map((story) => story.id);

describe('HnSource.feed', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('cuts appended pages from the snapshot the first page was ranked from', async () => {
        const hn = fakeHn(70);
        const first = await hn.source.feed('top', 0);
        hn.rerank(Array.from({ length: 70 }, (_, index) => 70 - index));

        const second = await hn.source.feed('top', 1);
        const third = await hn.source.feed('top', 2);

        expect(ids(first)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
        expect(ids(second)).toEqual(Array.from({ length: 30 }, (_, index) => index + 31));
        expect(ids(third)).toEqual(Array.from({ length: 10 }, (_, index) => index + 61));
        expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);
        expect(hn.calls.rankings).toBe(1);
    });

    it('takes a new snapshot when the first page is refreshed', async () => {
        const hn = fakeHn(60);
        await hn.source.feed('top', 0);
        await hn.source.feed('top', 1);
        hn.rerank(Array.from({ length: 60 }, (_, index) => 60 - index));

        const first = await hn.source.feed('top', 0, true);
        const second = await hn.source.feed('top', 1, true);

        expect(ids(first)[0]).toBe(60);
        expect(ids(second)[0]).toBe(30);
    });

    it('reuses the first page for a minute and shares concurrent requests', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const hn = fakeHn(40);

        await Promise.all([hn.source.feed('top', 0), hn.source.feed('top', 0)]);
        await hn.source.feed('top', 0);
        expect(hn.calls).toEqual({ rankings: 1, items: 30 });

        vi.setSystemTime(Date.now() + 61_000);
        await hn.source.feed('top', 0);
        expect(hn.calls.rankings).toBe(2);
    });
});
