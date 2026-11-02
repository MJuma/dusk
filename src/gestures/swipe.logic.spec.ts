import { describe, expect, it } from 'vitest';

import { levelOf, lockAxis, offsetFor, pickAction, sideOf, swipeConfig } from './swipe.logic';

const config = swipeConfig(390);

describe('swipe logic', () => {
    it('waits before deciding, then tells swipes from scrolls', () => {
        expect(lockAxis(6, 2, config)).toBeUndefined();
        expect(lockAxis(14, 5, config)).toBe('x');
        expect(lockAxis(12, 11, config)).toBe('y');
        expect(lockAxis(-3, -20, config)).toBe('y');
    });

    it('maps finger direction to the side it uncovers, and distance to short/long', () => {
        expect(sideOf(40)).toBe('left');
        expect(sideOf(-40)).toBe('right');
        expect([levelOf(30, config), levelOf(-70, config), levelOf(config.longPx, config)]).toEqual([0, 1, 2]);
    });

    it('runs the long action on a long swipe, falling back to the short one', () => {
        expect(pickAction(['reply', 'share'], 1)).toBe('reply');
        expect(pickAction(['reply', 'share'], 2)).toBe('share');
        expect(pickAction(['reply', 'none'], 2)).toBe('reply');
        expect(pickAction(['none', 'share'], 1)).toBeUndefined();
        expect(pickAction(['reply', 'share'], 0)).toBeUndefined();
    });

    it('follows the finger, then resists past the long threshold', () => {
        expect(offsetFor(-80, config)).toBe(-80);
        expect(offsetFor(config.longPx + 100, config)).toBe(config.longPx + 35);
    });
});
