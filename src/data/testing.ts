// Test helpers for the captured HN thread fixtures (see scripts/capture-fixture.mjs). Specs only.
import type { FetchJson } from './thread.loader';
import type { AlgoliaItem, FirebaseItem } from './types';
import large from './fixtures/large.json';
import medium from './fixtures/medium.json';
import small from './fixtures/small.json';

export type RowState = 'open' | 'collapsed' | 'hidden';

export interface HnLinks {
    root?: number;
    parent?: number;
    prev?: number;
    next?: number;
}

export type ExpectedRow = [id: number, depth: number, state: RowState, links: HnLinks];

export interface Fixture {
    storyId: number;
    expected: ExpectedRow[];
    algolia: AlgoliaItem;
    firebase: Record<string, FirebaseItem>;
}

export const fixtures = { large, medium, small } as unknown as Record<string, Fixture>;

/**
 * Dead comments that Algolia omits and whose parent has no other replies, so Dusk never asks
 * Firebase about them. HN shows them collapsed; Dusk reports their live replies as unavailable.
 */
export const KNOWN_GAPS: Record<string, number[]> = { large: [50244326] };

export function withoutSubtrees(expected: readonly ExpectedRow[], roots: readonly number[]): ExpectedRow[] {
    const kept: ExpectedRow[] = [];
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

export interface FakeApi {
    fetchJson: FetchJson;
    firebaseRequests: number[];
}

export function fakeApi(fixture: Fixture, algolia: AlgoliaItem | null = fixture.algolia): FakeApi {
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
