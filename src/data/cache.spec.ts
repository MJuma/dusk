import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFeedPage, readThread, writeFeedPage, writeThread } from './cache';
import type { Story, Thread } from './types';

function story(id: number): Story {
    return { id, type: 'story', title: `Story ${id}`, url: null, domain: null, by: 'pg', score: 1, time: 0, descendants: 0, text: null };
}

function thread(id: number): Thread {
    return { story: story(id), comments: [], complete: true, unavailable: 0 };
}

describe('browsing cache', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('remembers feed pages', async () => {
        await writeFeedPage('top', 1, [story(5), story(6)], true);

        expect(await readFeedPage('top', 1)).toMatchObject({ page: 1, hasMore: true, stories: [{ id: 5 }, { id: 6 }] });
        expect(await readFeedPage('new', 1)).toBeUndefined();
    });

    it('keeps the 40 most recently read threads', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        for (let id = 1; id <= 45; id++) {
            vi.setSystemTime(1_000_000 + id);
            await writeThread(thread(id));
        }

        expect(await readThread(5)).toBeUndefined();
        expect((await readThread(6))?.thread.story.id).toBe(6);
        expect((await readThread(45))?.at).toBe(1_000_045);
    });
});
