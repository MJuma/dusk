// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

let settingsModule: Awaited<ReturnType<typeof loadSettings>>;
const loadSettings = () => import('./settings');

beforeAll(async () => {
    // jsdom has no matchMedia; the settings module reads it on load.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => undefined }));
    settingsModule = await loadSettings();
});

describe('parseSettings', () => {
    it('fills in defaults and ignores unknown values', () => {
        expect(settingsModule.parseSettings('{"theme":"dark-reader","thumbnails":"sepia","width":"full"}')).toEqual({
            theme: 'dark-reader',
            thumbnails: 'images',
            commentsTarget: 'auto',
            width: 'full',
            indent: 'normal',
        });
        expect(settingsModule.parseSettings('not json').theme).toBe('system');
    });
});

describe('resolveTheme', () => {
    it('follows the system between Dusk and Light, and keeps explicit choices', () => {
        expect(settingsModule.resolveTheme('system', false)).toBe('dusk');
        expect(settingsModule.resolveTheme('system', true)).toBe('light');
        expect(settingsModule.resolveTheme('black', true)).toBe('black');
    });

    it('applies the theme to the page', () => {
        settingsModule.updateSettings({ theme: 'dim' });

        expect(document.documentElement.dataset['theme']).toBe('dim');
    });
});
