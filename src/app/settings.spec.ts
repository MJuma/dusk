// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Settings } from './settings.schema';

const loadSettings = () => import('./settings');
const loadSchema = () => import('./settings.schema');
const loadPages = () => import('./settings.pages');
let settingsModule: Awaited<ReturnType<typeof loadSettings>>;
let schema: Awaited<ReturnType<typeof loadSchema>>;
let defaults: Settings;

beforeAll(async () => {
    // jsdom has no matchMedia; the settings module reads it on load.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => undefined }));
    settingsModule = await loadSettings();
    schema = await loadSchema();
    defaults = schema.deviceDefaults();
});

describe('stored settings', () => {
    it('upgrades the old unversioned format, dropping "auto" and invalid values', () => {
        const old = '{"theme":"dark-reader","thumbnails":"sepia","width":"full","commentsTarget":"auto","indent":"wide"}';
        expect(schema.decodeSettings(old, defaults)).toEqual({ ...defaults, theme: 'dark-reader', width: 'full', indent: 'wide' });
        expect(schema.decodeSettings('not json', defaults)).toEqual(defaults);
    });

    it('stores only what differs from the defaults, and reads it back', () => {
        const changed: Settings = { ...defaults, font: 'charter', textScale: 1.2, showRank: false };
        const stored = schema.encodeSettings(changed, defaults);

        expect(JSON.parse(stored)).toEqual({ v: schema.STORAGE_VERSION, font: 'charter', textScale: 1.2, showRank: false });
        expect(schema.decodeSettings(stored, defaults)).toEqual(changed);
    });

    it('rejects out-of-range numbers and wrong types', () => {
        expect(schema.decodeSettings('{"v":1,"textScale":9,"showRank":"no"}', defaults)).toEqual(defaults);
    });
});

describe('settings pages', () => {
    it('show every setting exactly once', async () => {
        const { PAGES } = await loadPages();
        const keys = PAGES.flatMap((page) => page.sections.flatMap((section) => section.items.map((item) => item.key)));
        expect([...keys].sort()).toEqual([...schema.SETTING_KEYS].sort());
    });
});

describe('applying settings', () => {
    it('follows the system between Dusk and Light, and keeps explicit choices', () => {
        expect(settingsModule.resolveTheme('system', false)).toBe('dusk');
        expect(settingsModule.resolveTheme('system', true)).toBe('light');
        expect(settingsModule.resolveTheme('black', true)).toBe('black');
    });

    it('mirrors appearance settings to the page', () => {
        settingsModule.updateSettings({ theme: 'dim', font: 'verdana', showAuthor: false, textScale: 1.1 });
        const root = document.documentElement;

        expect(root.dataset['theme']).toBe('dim');
        expect(root.dataset['font']).toBe('verdana');
        expect(root.dataset['author']).toBe('off');
        expect(root.style.getPropertyValue('--text-scale')).toBe('1.1');
    });
});
