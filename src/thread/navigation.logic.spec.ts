import { describe, expect, it } from 'vitest';

import { pickTarget } from './navigation.logic';

const topLevel = [0, 5, 9];

describe('pickTarget', () => {
    it('moves to the next candidate after the current position', () => {
        expect(pickTarget(topLevel, -1, false, 1)).toBe(0);
        expect(pickTarget(topLevel, 0, false, 1)).toBe(5);
        expect(pickTarget(topLevel, 7, false, 1)).toBe(9);
        expect(pickTarget(topLevel, 9, false, 1)).toBeUndefined();
    });

    it('moves to the previous candidate, returning to the start of the current one first', () => {
        expect(pickTarget(topLevel, 7, false, -1)).toBe(5);
        expect(pickTarget(topLevel, 5, false, -1)).toBe(0);
        expect(pickTarget(topLevel, 5, true, -1)).toBe(5);
        expect(pickTarget(topLevel, 0, false, -1)).toBeUndefined();
        expect(pickTarget(topLevel, -1, false, -1)).toBeUndefined();
    });
});
