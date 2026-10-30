import { effect, signal } from '@preact/signals';

export type CommentsTarget = 'auto' | 'same' | 'new';
export type ContentWidth = 'wide' | 'full' | 'narrow';
export type IndentSize = 'compact' | 'normal' | 'wide';

export interface Settings {
    commentsTarget: CommentsTarget;
    width: ContentWidth;
    indent: IndentSize;
}

const KEY = 'dusk:settings';
const CHOICES: { [K in keyof Settings]: readonly Settings[K][] } = {
    commentsTarget: ['auto', 'same', 'new'],
    width: ['wide', 'full', 'narrow'],
    indent: ['compact', 'normal', 'wide'],
};
const DEFAULTS: Settings = { commentsTarget: 'auto', width: 'wide', indent: 'normal' };

function pick<K extends keyof Settings>(data: Record<string, unknown>, key: K): Settings[K] {
    const value = data[key];
    return (CHOICES[key] as readonly unknown[]).includes(value) ? (value as Settings[K]) : DEFAULTS[key];
}

export function parseSettings(raw: string | null): Settings {
    try {
        const data = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
        return { commentsTarget: pick(data, 'commentsTarget'), width: pick(data, 'width'), indent: pick(data, 'indent') };
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

// The stylesheet keys layout off these attributes; applied before the first render.
effect(() => {
    const { dataset } = document.documentElement;
    dataset['width'] = settings.value.width;
    dataset['indent'] = settings.value.indent;
});
