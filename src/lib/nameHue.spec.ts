import { describe, expect, it } from 'vitest';

import { nameHue } from './nameHue';

describe('nameHue', () => {
    it('gives a name the same hue every time, never orange, and spreads names out', () => {
        const names = ['pg', 'dang', 'tptacek', 'patio11', 'jacquesm', 'rayiner', 'pvg', 'simonw', 'kentonv', 'Animats'];
        const hues = names.map(nameHue);
        expect(names.map(nameHue)).toEqual(hues);
        expect(hues.every((hue) => hue > 70)).toBe(true);
        expect(new Set(hues).size).toBeGreaterThanOrEqual(6);
    });
});
