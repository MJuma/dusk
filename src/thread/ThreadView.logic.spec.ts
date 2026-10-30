import { describe, expect, it } from 'vitest';

import type { ThreadComment } from '../data/types';
import { indexThread } from './threadIndex';
import { expandAncestors, visibleRows } from './ThreadView.logic';

// 1 ─ 2 ─ 3
//   └ 4
// 5 (flagged: collapsed by default) ─ 6
function comment(id: number, parentId: number, depth: number, descendantCount: number, collapsedByDefault = false): ThreadComment {
    return {
        id,
        parentId,
        depth,
        author: 'a',
        html: '',
        time: 0,
        collapsedByDefault,
        placeholder: false,
        siblingIndex: 0,
        topLevelIndex: id < 5 ? 0 : 1,
        childCount: 0,
        descendantCount,
    };
}

const comments = [
    comment(1, 100, 0, 3),
    comment(2, 1, 1, 1),
    comment(3, 2, 2, 0),
    comment(4, 1, 1, 0),
    comment(5, 100, 0, 1, true),
    comment(6, 5, 1, 0),
];
const { position } = indexThread(comments);
const ids = (rows: ReturnType<typeof visibleRows>): number[] => rows.map((row) => row.comment.id);

describe('visibleRows', () => {
    it('hides replies of collapsed comments and counts new ones inside', () => {
        const rows = visibleRows(comments, new Set([1]), new Set([3, 6]));

        expect(ids(rows)).toEqual([1, 5]);
        expect(rows.map((row) => row.newInside)).toEqual([1, 1]);
    });

    it('expands a comment that HN collapses by default when toggled', () => {
        expect(ids(visibleRows(comments, new Set([5])))).toEqual([1, 2, 3, 4, 5, 6]);
    });
});

describe('expandAncestors', () => {
    it('expands every collapsed ancestor of the target', () => {
        const toggled = expandAncestors(comments, position, 3, new Set([1, 2]));

        expect(toggled).toEqual(new Set());
    });

    it('expands default-collapsed ancestors by toggling them', () => {
        expect(expandAncestors(comments, position, 6, new Set())).toEqual(new Set([5]));
    });

    it('returns the same set when nothing needs expanding', () => {
        const toggled = new Set([4]);

        expect(expandAncestors(comments, position, 3, toggled)).toBe(toggled);
    });
});
