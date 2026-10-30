import { effect, signal } from '@preact/signals';

export type CommentsTarget = 'auto' | 'same' | 'new';
export type ContentWidth = 'wide' | 'full' | 'narrow';
export type IndentSize = 'compact' | 'normal' | 'wide';
export type Theme = 'system' | 'dusk' | 'dark-reader' | 'dim' | 'black' | 'light';
export type Thumbnails = 'images' | 'icons' | 'off';

export interface Settings {
    theme: Theme;
    thumbnails: Thumbnails;
    commentsTarget: CommentsTarget;
    width: ContentWidth;
    indent: IndentSize;
}

/** Page background per theme, for the browser/status bar color. Mirrors --bg in app.css. */
const THEME_BACKGROUNDS: Record<Exclude<Theme, 'system'>, string> = {
    'dusk': '#101216',
    'dark-reader': '#181a1b',
    'dim': '#22272e',
    'black': '#000000',
    'light': '#f6f6ef',
};

const KEY = 'dusk:settings';
const CHOICES: { [K in keyof Settings]: readonly Settings[K][] } = {
    theme: ['system', 'dusk', 'dark-reader', 'dim', 'black', 'light'],
    thumbnails: ['images', 'icons', 'off'],
    commentsTarget: ['auto', 'same', 'new'],
    width: ['wide', 'full', 'narrow'],
    indent: ['compact', 'normal', 'wide'],
};
const DEFAULTS: Settings = { theme: 'system', thumbnails: 'images', commentsTarget: 'auto', width: 'wide', indent: 'normal' };

function pick<K extends keyof Settings>(data: Record<string, unknown>, key: K): Settings[K] {
    const value = data[key];
    return (CHOICES[key] as readonly unknown[]).includes(value) ? (value as Settings[K]) : DEFAULTS[key];
}

export function parseSettings(raw: string | null): Settings {
    try {
        const data = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
        return {
            theme: pick(data, 'theme'),
            thumbnails: pick(data, 'thumbnails'),
            commentsTarget: pick(data, 'commentsTarget'),
            width: pick(data, 'width'),
            indent: pick(data, 'indent'),
        };
    } catch {
        return DEFAULTS;
    }
}

function load(): Settings {
    try {
        return parseSettings(localStorage.getItem(KEY));
    } catch {
        return DEFAULTS;
    }
}

export const settings = signal<Settings>(load());
export const settingsOpen = signal(false);

export function updateSettings(patch: Partial<Settings>): void {
    settings.value = { ...settings.value, ...patch };
    try {
        localStorage.setItem(KEY, JSON.stringify(settings.value));
    } catch {
        // Storage disabled: settings last for this session.
    }
}

function isInstalledApp(): boolean {
    return matchMedia('(display-mode: standalone)').matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Auto opens comments in a new tab on a laptop, but stays in place on a phone or in the installed app. */
export function commentsInNewTab(current: Settings): boolean {
    if (current.commentsTarget === 'auto') {
        return !isInstalledApp() && matchMedia('(pointer: fine)').matches;
    }
    return current.commentsTarget === 'new';
}

window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
        settings.value = parseSettings(event.newValue);
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

// The stylesheet keys theme and layout off these attributes; applied before the first render.
effect(() => {
    const { dataset } = document.documentElement;
    const theme = resolveTheme(settings.value.theme, systemLight.value);
    dataset['theme'] = theme;
    dataset['width'] = settings.value.width;
    dataset['indent'] = settings.value.indent;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BACKGROUNDS[theme]);
});
