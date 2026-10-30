import { describe, expect, it } from 'vitest';

import { visibleRows } from '../thread/ThreadView.logic';
import { FIRST_SCREEN_ROWS } from './thread.logic';
import { loadThread } from './thread.loader';
import type { FetchJson } from './thread.loader';
import type { AlgoliaItem, FirebaseItem, Thread } from './types';
import large from './fixtures/large.json';
import medium from './fixtures/medium.json';
import small from './fixtures/small.json';

type RowState = 'open' | 'collapsed' | 'hidden';

interface Fixture {
    storyId: number;
    expected: [number, number, RowState][];
    algolia: AlgoliaItem;
    firebase: Record<string, FirebaseItem>;
}

const fixtures = { large, medium, small } as unknown as Record<string, Fixture>;

/**
 * Dead comments that Algolia omits and whose parent has no other replies, so Dusk never asks
 * Firebase about them. HN shows them collapsed; Dusk reports their live replies as unavailable.
 */
const KNOWN_GAPS: Record<string, number[]> = { large: [50244326] };

function withoutSubtrees(expected: Fixture['expected'], roots: readonly number[]): Fixture['expected'] {
    const kept: Fixture['expected'] = [];
    let skipBelow = Number.POSITIVE_INFINITY;
    for (const row of expected) {
        const [id, depth] = row;
        if (depth <= skipBelow) {
            skipBelow = roots.includes(id) ? depth : Number.POSITIVE_INFINITY;
        }
        if (skipBelow === Number.POSITIVE_INFINITY) {
            kept.push(row);
        }
    }
    return kept;
}

interface FakeApi {
    fetchJson: FetchJson;
    firebaseRequests: number[];
}

function fakeApi(fixture: Fixture, algolia: AlgoliaItem | null = fixture.algolia): FakeApi {
    const firebaseRequests: number[] = [];
    const fetchJson = (async (url: string) => {
        const firebase = /\/item\/(\d+)\.json$/.exec(url);
        if (firebase) {
            const id = Number(firebase[1]);
            firebaseRequests.push(id);
            return fixture.firebase[id] ?? null;
        }
        if (url.includes('hn.algolia.com') && algolia) {
            return structuredClone(algolia);
        }
        throw new Error(`404 ${url}`);
    }) as FetchJson;
    return { fetchJson, firebaseRequests };
}

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
});
