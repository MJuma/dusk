import { describe, expect, it } from 'vitest';

import { visibleRows } from '../thread/ThreadView.logic';
import { fakeApi, fixtures, KNOWN_GAPS, withoutSubtrees } from './testing';
import type { Fixture } from './testing';
import { FIRST_SCREEN_ROWS } from './thread.logic';
import { loadThread } from './thread.loader';
import type { FetchJson } from './thread.loader';
import type { AlgoliaItem, FirebaseItem, Thread } from './types';

function rows(thread: Thread): [number, number][] {
    return thread.comments.map((comment) => [comment.id, comment.depth]);
}

function expectedRows(fixture: Fixture): [number, number][] {
    return fixture.expected.map(([id, depth]) => [id, depth]);
}

describe('loadThread', () => {
    it.each(Object.keys(fixtures))('matches HN display order, depth and default collapsing for the %s fixture', async (name) => {
        const fixture = fixtures[name] as Fixture;
        const gaps = KNOWN_GAPS[name] ?? [];
        const expected = withoutSubtrees(fixture.expected, gaps);
        const api = fakeApi(fixture);

        const thread = await loadThread(fixture.storyId, api.fetchJson);

        expect(thread.complete).toBe(true);
        expect(rows(thread)).toEqual(expected.map(([id, depth]) => [id, depth]));
        expect(thread.comments.filter((comment) => comment.collapsedByDefault).map((comment) => comment.id))
            .toEqual(expected.filter(([, , state]) => state === 'collapsed').map(([id]) => id));
        expect(visibleRows(thread.comments, new Set()).map((row) => row.comment.id))
            .toEqual(expected.filter(([, , state]) => state !== 'hidden').map(([id]) => id));
        // Live replies under the unreachable dead comments (the dead roots themselves aren't counted by HN).
        expect(thread.unavailable).toBe(fixture.expected.length - expected.length - gaps.length);
        // Each comment knows its position among its parent's replies (drives the alternating card shade).
        const lastSibling = new Map<number, number>();
        const expectedSiblingIndex = thread.comments.map((comment) => {
            const index = (lastSibling.get(comment.parentId) ?? -1) + 1;
            lastSibling.set(comment.parentId, index);
            return index;
        });
        expect(thread.comments.map((comment) => comment.siblingIndex)).toEqual(expectedSiblingIndex);
        // Only the story, multi-reply parents and replies missing from Algolia are fetched, not every comment.
        expect(api.firebaseRequests.length).toBeLessThan(fixture.expected.length / 2);
    });

    it('renders a first screen that already matches HN before ordering the rest', async () => {
        const fixture = fixtures['large'] as Fixture;
        const partials: Thread[] = [];

        await loadThread(fixture.storyId, fakeApi(fixture).fetchJson, {
            onPartial: (thread) => {
                partials.push(thread);
            },
        });

        expect(partials).toHaveLength(1);
        expect(partials[0]?.complete).toBe(false);
        expect(rows(partials[0] as Thread).slice(0, FIRST_SCREEN_ROWS)).toEqual(expectedRows(fixture).slice(0, FIRST_SCREEN_ROWS));
    });

    it('fills in replies that Algolia has not indexed yet without disturbing order', async () => {
        const fixture = fixtures['medium'] as Fixture;
        const newestTopLevel = Math.max(...fixture.expected.filter(([, depth]) => depth === 0).map(([id]) => id));
        // Simulate index lag: Algolia stops at the newest top-level comment.
        const prune = (node: AlgoliaItem): AlgoliaItem => ({
            ...node,
            children: node.children.filter((child) => child.id < newestTopLevel).map(prune),
        });
        const algolia = prune(fixture.algolia);

        const thread = await loadThread(fixture.storyId, fakeApi(fixture, algolia).fetchJson);

        const ids = new Set(thread.comments.map((comment) => comment.id));
        expect(ids.has(newestTopLevel)).toBe(true);
        expect(rows(thread)).toEqual(expectedRows(fixture).filter(([id]) => ids.has(id)));
    });

    it.each(['small', 'medium'])('falls back to Firebase alone when Algolia is unavailable (%s)', async (name) => {
        const fixture = fixtures[name] as Fixture;

        const thread = await loadThread(fixture.storyId, fakeApi(fixture, null).fetchJson);

        expect(rows(thread)).toEqual(expectedRows(fixture));
    });

    it('opens a comment link as its story\'s thread, focused on the comment', async () => {
        const fixture = fixtures['medium'] as Fixture;
        const [commentId] = fixture.expected.find(([, depth]) => depth === 2) ?? [];

        const thread = await loadThread(commentId as number, fakeApi(fixture).fetchJson);

        expect(thread.story.id).toBe(fixture.storyId);
        expect(thread.focus).toBe(commentId);
        expect(thread.comments.some((comment) => comment.id === commentId)).toBe(true);
    });

    it('loads poll options in order', async () => {
        const items: Record<number, FirebaseItem> = {
            1: { id: 1, type: 'poll', title: 'Poll', by: 'pg', time: 1, descendants: 0, parts: [3, 2] },
            2: { id: 2, type: 'pollopt', text: 'B', score: 5 },
            3: { id: 3, type: 'pollopt', text: 'A', score: 9 },
        };
        const fetchJson = (async (url: string) => {
            const firebase = /\/item\/(\d+)\.json$/.exec(url);
            if (firebase) {
                return items[Number(firebase[1])] ?? null;
            }
            return { id: 1, type: 'poll', author: 'pg', text: null, created_at_i: 1, parent_id: null, children: [] };
        }) as FetchJson;

        const thread = await loadThread(1, fetchJson);

        expect(thread.poll).toEqual([{ id: 3, text: 'A', score: 9 }, { id: 2, text: 'B', score: 5 }]);
    });
});
