import { describe, expect, it } from 'vitest';

import { hnAge } from './time';

const NOW = Date.UTC(2026, 10, 2, 20, 0, 0);
const before = (seconds: number): number => NOW / 1000 - seconds;
const DAY = 86_400;

describe('hnAge', () => {
    it('words ages like HN, switching units where HN does', () => {
        expect(hnAge(before(20), NOW)).toBe('0 minutes ago');
        expect(hnAge(before(60), NOW)).toBe('1 minute ago');
        expect(hnAge(before(47 * 60), NOW)).toBe('47 minutes ago');
        expect(hnAge(before(3600), NOW)).toBe('1 hour ago');
        expect(hnAge(before(23 * 3600 + 3599), NOW)).toBe('23 hours ago');
        expect(hnAge(before(87 * DAY), NOW)).toBe('87 days ago');
        expect(hnAge(before(104 * DAY), NOW)).toBe('3 months ago');
        expect(hnAge(before(346 * DAY), NOW)).toBe('11 months ago');
    });

    it('shows the date past a year, with HN month names', () => {
        expect(hnAge(Date.UTC(2025, 8, 10, 16) / 1000, NOW)).toBe('on Sept 10, 2025');
        expect(hnAge(Date.UTC(2023, 3, 4, 19) / 1000, NOW)).toBe('on April 4, 2023');
    });
});
