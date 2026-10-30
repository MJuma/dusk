import { describe, expect, it } from 'vitest';

import { fakeApi, fixtures, KNOWN_GAPS } from '../data/testing';
import type { HnLinks } from '../data/testing';
import { loadThread } from '../data/thread.loader';
import { indexThread } from './threadIndex';

describe('indexThread', () => {
    it.each(Object.keys(fixtures))('matches HN\'s root, parent, prev and next links for the %s fixture', async (name) => {
        const fixture = fixtures[name] as (typeof fixtures)[string];
        const thread = await loadThread(fixture.storyId, fakeApi(fixture).fetchJson);
        const index = indexThread(thread.comments);
        const loaded = new Set(thread.comments.map((comment) => comment.id));
        const gaps = new Set(KNOWN_GAPS[name] ?? []);

        const actual: Record<number, HnLinks> = {};
        const expected: Record<number, HnLinks> = {};
        for (const [id, , , links] of fixture.expected) {
            // Rows Dusk can't load (under an unreachable dead comment) have no links to compare.
            if (loaded.has(id) && !Object.values(links).some((target) => gaps.has(target))) {
                actual[id] = { ...index.links.get(id) };
                expected[id] = links;
            }
        }

        expect(Object.keys(expected).length).toBeGreaterThan(fixture.expected.length * 0.95);
        expect(actual).toEqual(expected);
        expect(index.topLevel.map((position) => thread.comments[position]?.id))
            .toEqual(fixture.expected.filter(([, depth]) => depth === 0).map(([id]) => id));
    });
});
