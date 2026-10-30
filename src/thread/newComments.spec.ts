import { describe, expect, it } from 'vitest';

import type { ThreadComment } from '../data/types';
import { maxCommentId, newCommentEstimate, newCommentIds } from './newComments';

function comment(id: number, placeholder = false): ThreadComment {
    return {
        id,
        parentId: 1,
        depth: 0,
        author: 'a',
        html: '',
        time: 0,
        collapsedByDefault: false,
        placeholder,
        topLevelIndex: 0,
        childCount: 0,
        descendantCount: 0,
    };
}

const comments = [comment(10), comment(20), comment(30), comment(40, true)];

describe('newCommentIds', () => {
    it('reports nothing on a first visit', () => {
        expect(newCommentIds(comments, undefined)).toEqual(new Set());
        expect(newCommentIds(comments, { linkAt: 1 })).toEqual(new Set());
    });

    it('marks comments posted since the last load, but not dead placeholders', () => {
        expect(newCommentIds(comments, { maxId: 15 })).toEqual(new Set([20, 30]));
    });

    it('keeps earlier new comments that were never scrolled into view', () => {
        expect(newCommentIds(comments, { maxId: 25, unseen: [10, 99] })).toEqual(new Set([10, 30]));
    });
});

describe('maxCommentId', () => {
    it('returns the highest id, or 0 for no comments', () => {
        expect(maxCommentId(comments)).toBe(40);
        expect(maxCommentId([])).toBe(0);
    });
});

describe('newCommentEstimate', () => {
    it('counts comments added since the last load plus ones still unseen', () => {
        expect(newCommentEstimate(57, { count: 50, unseen: [1, 2] })).toBe(9);
    });

    it('never goes negative and is 0 before the comments were opened', () => {
        expect(newCommentEstimate(40, { count: 50 })).toBe(0);
        expect(newCommentEstimate(40, { linkAt: 1 })).toBe(0);
        expect(newCommentEstimate(40, undefined)).toBe(0);
    });
});
