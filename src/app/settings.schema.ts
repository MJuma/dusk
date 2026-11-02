/**
 * Every setting, its allowed values and its default, in one table. Types, validation, storage
 * and the settings pages all derive from it, so adding a setting is one entry here plus its
 * label in `SettingsPages.tsx`.
 *
 * Settings that only change how things look also name an `attr`: the value is mirrored to a
 * `data-*` attribute on <html> (booleans as "on"/"off") and the stylesheet does the rest.
 */
import { hasFinePointer, isInstalledApp, isIos, isIpad } from './device';

interface Base<T> {
    /** A fixed default, or one that depends on the device (worked out once at startup). */
    default: T | (() => T);
    /** Mirror the value to `<html data-{attr}>`. */
    attr?: string;
}

export interface ChoiceDef<T extends string = string> extends Base<T> {
    kind: 'choice';
    values: readonly T[];
}

export interface BoolDef extends Base<boolean> {
    kind: 'bool';
}

export interface RangeDef extends Base<number> {
    kind: 'range';
    min: number;
    max: number;
    step: number;
}

export type SettingDef = ChoiceDef | BoolDef | RangeDef;

function choice<const T extends string>(values: readonly T[], fallback: NoInfer<T> | (() => NoInfer<T>), attr?: string): ChoiceDef<T> {
    return { kind: 'choice', values, default: fallback, attr };
}

function bool(fallback: boolean | (() => boolean), attr?: string): BoolDef {
    return { kind: 'bool', default: fallback, attr };
}

function range(min: number, max: number, step: number, fallback: number): RangeDef {
    return { kind: 'range', min, max, step, default: fallback };
}

/** Actions a story row can be swiped to. */
export const STORY_SWIPE_ACTIONS = ['none', 'save', 'reply', 'author', 'share'] as const;
/** Actions a comment can be swiped to. */
export const COMMENT_SWIPE_ACTIONS = ['none', 'reply', 'author', 'share', 'collapse', 'collapse-top'] as const;

export type StorySwipeAction = (typeof STORY_SWIPE_ACTIONS)[number];
export type CommentSwipeAction = (typeof COMMENT_SWIPE_ACTIONS)[number];

const laptop = (): boolean => hasFinePointer() && !isIos();

export const SCHEMA = {
    // Appearance › General
    theme: choice(['system', 'dusk', 'dark-reader', 'dim', 'black', 'light'], 'system'),
    font: choice(['system', 'verdana', 'avenir', 'charter', 'iowan'], 'system', 'font'),
    /** Follow iOS's text size (Settings › Display & Brightness › Text Size). iPhone/iPad only. */
    systemTextSize: bool(true),
    /** Text size when not following the system, as a multiple of the normal size. */
    textScale: range(0.8, 1.5, 0.05, 1),
    width: choice(['wide', 'full', 'narrow'], 'wide', 'width'),
    splitView: bool(isIpad, 'split'),
    // Appearance › Posts
    showRank: bool(true, 'rank'),
    thumbnails: choice(['images', 'icons', 'off'], 'images'),
    showDomain: bool(true, 'domain'),
    showAuthor: bool(true, 'author'),
    // Appearance › Comments
    indent: choice(['compact', 'normal', 'wide'], 'normal', 'indent'),
    // Posts
    /** The buttons under each story: "discuss", "link + discuss", both or neither. */
    storyButtons: choice(['comments', 'link', 'both', 'none'], () => (laptop() ? 'both' : 'none'), 'story-buttons'),
    // Comments
    /** New tab on a laptop; in place on phones, tablets and in the installed app. */
    commentsTarget: choice(['same', 'new'], () => (laptop() && !isInstalledApp() ? 'new' : 'same')),
    // Gestures: "left" swipes are the actions on a row's left, revealed by moving the finger right.
    storySwipeLeftShort: choice(STORY_SWIPE_ACTIONS, 'none'),
    storySwipeLeftLong: choice(STORY_SWIPE_ACTIONS, 'none'),
    storySwipeRightShort: choice(STORY_SWIPE_ACTIONS, 'none'),
    storySwipeRightLong: choice(STORY_SWIPE_ACTIONS, 'none'),
    commentSwipeLeftShort: choice(COMMENT_SWIPE_ACTIONS, 'none'),
    commentSwipeLeftLong: choice(COMMENT_SWIPE_ACTIONS, 'none'),
    commentSwipeRightShort: choice(COMMENT_SWIPE_ACTIONS, 'none'),
    commentSwipeRightLong: choice(COMMENT_SWIPE_ACTIONS, 'none'),
    /** No left-side swipe actions; swiping right anywhere goes back (installed app). */
    disableLeftSwipes: bool(true),
    /** No right-side swipe actions; swiping left anywhere goes forward (installed app). */
    disableRightSwipes: bool(true),
} as const;

type ValueOf<D> = D extends ChoiceDef<infer T> ? T : D extends BoolDef ? boolean : number;

export type Settings = { -readonly [K in keyof typeof SCHEMA]: ValueOf<(typeof SCHEMA)[K]> };
export type SettingKey = keyof Settings;
export type Theme = Settings['theme'];
export type Thumbnails = Settings['thumbnails'];

export const SETTING_KEYS = Object.keys(SCHEMA) as SettingKey[];

/** The defaults on this device. */
export function deviceDefaults(): Settings {
    const values: Record<string, unknown> = {};
    for (const key of SETTING_KEYS) {
        const fallback = SCHEMA[key].default;
        values[key] = typeof fallback === 'function' ? fallback() : fallback;
    }
    return values as Settings;
}

function valid(def: SettingDef, value: unknown): boolean {
    switch (def.kind) {
        case 'choice':
            return (def.values as readonly unknown[]).includes(value);
        case 'bool':
            return typeof value === 'boolean';
        case 'range':
            return typeof value === 'number' && Number.isFinite(value) && value >= def.min && value <= def.max;
    }
}

/**
 * Stored settings are `{ v, ...changed }`: only values that differ from the defaults, so a better
 * default later reaches everyone who never picked otherwise. Each migration upgrades one version.
 */
export const STORAGE_VERSION = 1;
const MIGRATIONS: ((data: Record<string, unknown>) => Record<string, unknown>)[] = [
    // 0 → 1: settings were stored whole and unversioned. "auto" for comments is now the device default.
    ({ commentsTarget, ...rest }) => (commentsTarget === 'auto' ? rest : { ...rest, commentsTarget }),
];

export function decodeSettings(raw: string | null, defaults: Settings): Settings {
    let data: Record<string, unknown> = {};
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            data = parsed as Record<string, unknown>;
        }
    } catch {
        return defaults;
    }
    const version = typeof data['v'] === 'number' ? data['v'] : 0;
    for (let at = version; at < STORAGE_VERSION; at++) {
        data = MIGRATIONS[at]?.(data) ?? data;
    }
    const values: Record<string, unknown> = { ...defaults };
    for (const key of SETTING_KEYS) {
        if (valid(SCHEMA[key], data[key])) {
            values[key] = data[key];
        }
    }
    return values as Settings;
}

export function encodeSettings(values: Settings, defaults: Settings): string {
    const changed: Record<string, unknown> = { v: STORAGE_VERSION };
    for (const key of SETTING_KEYS) {
        if (values[key] !== defaults[key]) {
            changed[key] = values[key];
        }
    }
    return JSON.stringify(changed);
}
