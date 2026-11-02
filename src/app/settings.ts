import { effect, signal } from '@preact/signals';

import { isIos } from './device';
import { decodeSettings, deviceDefaults, encodeSettings, SCHEMA, SETTING_KEYS } from './settings.schema';
import type { Settings, Theme } from './settings.schema';

export type { Settings, SettingKey, Theme, Thumbnails } from './settings.schema';
export { isInstalledApp } from './device';

/** Page background per theme, for the browser/status bar color. Mirrors --bg in app.css. */
const THEME_BACKGROUNDS: Record<Exclude<Theme, 'system'>, string> = {
    'dusk': '#101216',
    'dark-reader': '#181a1b',
    'dim': '#22272e',
    'black': '#000000',
    'light': '#f6f6ef',
};

const KEY = 'dusk:settings';
export const DEFAULTS: Settings = deviceDefaults();

function load(): Settings {
    try {
        return decodeSettings(localStorage.getItem(KEY), DEFAULTS);
    } catch {
        return DEFAULTS;
    }
}

export const settings = signal<Settings>(load());
export const settingsOpen = signal(false);

export function updateSettings(patch: Partial<Settings>): void {
    settings.value = { ...settings.value, ...patch };
    try {
        localStorage.setItem(KEY, encodeSettings(settings.value, DEFAULTS));
    } catch {
        // Storage disabled: settings last for this session.
    }
}

/** Whether story rows open comments in a new tab. Never in split view: the story opens beside the list. */
export function commentsInNewTab(current: Settings, split: boolean): boolean {
    return current.commentsTarget === 'new' && !split;
}

window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
        settings.value = decodeSettings(event.newValue, DEFAULTS);
    }
});

const prefersLight = matchMedia('(prefers-color-scheme: light)');
const systemLight = signal(prefersLight.matches);
prefersLight.addEventListener('change', (event) => {
    systemLight.value = event.matches;
});

/** The theme actually shown: "system" follows the OS between Dusk and Light. */
export function resolveTheme(theme: Theme, light: boolean): Exclude<Theme, 'system'> {
    if (theme === 'system') {
        return light ? 'light' : 'dusk';
    }
    return theme;
}

// The stylesheet keys appearance off attributes on <html>; applied before the first render.
effect(() => {
    const current = settings.value;
    const root = document.documentElement;
    for (const key of SETTING_KEYS) {
        const { attr } = SCHEMA[key];
        if (attr) {
            const value = current[key];
            root.setAttribute(`data-${attr}`, typeof value === 'boolean' ? (value ? 'on' : 'off') : String(value));
        }
    }
    const theme = resolveTheme(current.theme, systemLight.value);
    root.dataset['theme'] = theme;
    // Only iOS can follow the system text size; elsewhere (and when it's off) the slider applies.
    root.dataset['textSize'] = isIos() && current.systemTextSize ? 'system' : 'scaled';
    root.style.setProperty('--text-scale', String(current.textScale));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BACKGROUNDS[theme]);
});
