// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { writeFeedPage, writeThread } from '../data/cache';
import type { Story, Thread } from '../data/types';
import { putThread } from '../offline/store';
import { CACHE_DB, clearRecords, countRecords, OFFLINE_DB, removeKeys } from './storage';

function story(id: number): Story {
    return { id, type: 'story', title: `Story ${id}`, url: null, domain: null, by: 'pg', score: 1, time: 0, descendants: 0, text: null };
}

function thread(id: number): Thread {
    return { story: story(id), comments: [], complete: true, unavailable: 0 };
}

describe('storage', () => {
    it('counts and clears the databases the app writes', async () => {
        await writeFeedPage('top', 0, [story(1)], false, { at: 1, ids: [1] });
        await writeThread(thread(2));
        await putThread(thread(3));

        expect(await countRecords(CACHE_DB)).toEqual([1, 1]);
        expect(await countRecords(OFFLINE_DB)).toEqual([1, 1, 0]);

        await clearRecords(CACHE_DB);
        await clearRecords(OFFLINE_DB);

        expect(await countRecords(CACHE_DB)).toEqual([0, 0]);
        expect(await countRecords(OFFLINE_DB)).toEqual([0, 0, 0]);
    });

    it('leaves a database that was never created alone', async () => {
        const missing = { name: 'dusk-missing', stores: ['things'] };

        expect(await countRecords(missing)).toEqual([]);
        await clearRecords(missing);

        expect((await indexedDB.databases()).map((database) => database.name)).not.toContain('dusk-missing');
    });

    it('removes only keys with the prefix', () => {
        localStorage.setItem('dusk:visit:1', '{}');
        localStorage.setItem('dusk:visit:2', '{}');
        localStorage.setItem('dusk:settings', '{}');

        removeKeys(localStorage, 'dusk:visit:');

        expect(Object.keys(localStorage).sort()).toEqual(['dusk:settings']);
    });
});
