import { computed, signal } from '@preact/signals';

import type { FeedKind } from '../data/types';

export type UserTab = 'submissions' | 'comments';
export type SearchType = 'stories' | 'comments';
export type SearchSort = 'popular' | 'recent';

export type Route =
    | { name: 'feed'; kind: FeedKind; page: number }
    /** `focus` is a comment to jump to once the thread has loaded. */
    | { name: 'item'; id: number; focus?: number }
    | { name: 'user'; id: string; tab: UserTab }
    /** Stories saved for offline reading. */
    | { name: 'saved' }
    /** A saved article in reader view. */
    | { name: 'read'; id: number }
    | { name: 'search'; query: string; type: SearchType; sort: SearchSort }
    /** A day's top stories (HN's "past"), as a UTC date `YYYY-MM-DD`. */
    | { name: 'past'; day: string }
    /** Newest comments across HN. */
    | { name: 'comments' }
    /** Stories from one site (HN's "from?site="). */
    | { name: 'from'; site: string };

export const FEEDS: readonly FeedKind[] = ['top', 'new', 'best', 'ask', 'show', 'jobs'];

const NUMBER = /^\d+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A UTC calendar day shifted by `delta` days. */
export function shiftDay(day: string, delta: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
}

export function today(nowMs: number = Date.now()): string {
    return new Date(nowMs).toISOString().slice(0, 10);
}

export function parseHash(hash: string): Route {
    const [first, second, third, fourth] = hash.replace(/^#\/?/, '').split('/');
    if (first === 'item' && second && NUMBER.test(second)) {
        return third && NUMBER.test(third) ? { name: 'item', id: Number(second), focus: Number(third) } : { name: 'item', id: Number(second) };
    }
    if (first === 'saved') {
        return { name: 'saved' };
    }
    if (first === 'search') {
        return {
            name: 'search',
            query: second ? decodeURIComponent(second) : '',
            type: third === 'comments' ? 'comments' : 'stories',
            sort: fourth === 'recent' ? 'recent' : 'popular',
        };
    }
    if (first === 'past') {
        return { name: 'past', day: second && DAY.test(second) ? second : shiftDay(today(), -1) };
    }
    if (first === 'comments') {
        return { name: 'comments' };
    }
    if (first === 'from' && second) {
        return { name: 'from', site: decodeURIComponent(second) };
    }
    if (first === 'read' && second && NUMBER.test(second)) {
        return { name: 'read', id: Number(second) };
    }
    if (first === 'user' && second) {
        return { name: 'user', id: decodeURIComponent(second), tab: third === 'comments' ? 'comments' : 'submissions' };
    }
    const kind = FEEDS.find((feed) => feed === first) ?? 'top';
    const page = second && /^\d+$/.test(second) ? Math.max(0, Number(second) - 1) : 0;
    return { name: 'feed', kind, page };
}

export function feedHref(kind: FeedKind, page = 0): string {
    return page > 0 ? `#/${kind}/${page + 1}` : `#/${kind}`;
}

export function itemHref(id: number, focus?: number): string {
    return focus === undefined ? `#/item/${id}` : `#/item/${id}/${focus}`;
}

export const SAVED_HREF = '#/saved';
export const COMMENTS_HREF = '#/comments';

export function searchHref(query = '', type: SearchType = 'stories', sort: SearchSort = 'popular'): string {
    return query ? `#/search/${encodeURIComponent(query)}/${type}/${sort}` : '#/search';
}

export function pastHref(day?: string): string {
    return day ? `#/past/${day}` : '#/past';
}

export function fromHref(site: string): string {
    return `#/from/${encodeURIComponent(site)}`;
}

export function readHref(id: number): string {
    return `#/read/${id}`;
}

export function userHref(id: string, tab: UserTab = 'submissions'): string {
    const base = `#/user/${encodeURIComponent(id)}`;
    return tab === 'comments' ? `${base}/comments` : base;
}

/** Where a page goes in split view: lists on the left, the story (or profile, or article) on the right. */
export type Pane = 'list' | 'detail';

interface RouteSpec<R extends Route> {
    /** Identifies the page, for scroll memory and titles. */
    key: (route: R) => string;
    /** The page's own part of the document title, if it has a fixed one. */
    title: (route: R) => string | undefined;
    pane: Pane;
}

const FEED_TITLES: Record<FeedKind, string | undefined> = { top: undefined, new: 'New', best: 'Best', ask: 'Ask', show: 'Show', jobs: 'Jobs' };

/** Everything about each kind of page besides parsing its address. */
const ROUTES: { [N in Route['name']]: RouteSpec<Extract<Route, { name: N }>> } = {
    feed: { key: (r) => `feed:${r.kind}:${r.page}`, title: (r) => FEED_TITLES[r.kind], pane: 'list' },
    item: { key: (r) => (r.focus === undefined ? `item:${r.id}` : `item:${r.id}:${r.focus}`), title: () => undefined, pane: 'detail' },
    user: { key: (r) => `user:${r.id}:${r.tab}`, title: (r) => (r.tab === 'comments' ? `${r.id}'s comments` : `Profile: ${r.id}`), pane: 'detail' },
    saved: { key: () => 'saved', title: () => 'Saved', pane: 'list' },
    read: { key: (r) => `read:${r.id}`, title: () => 'Reader', pane: 'detail' },
    search: { key: (r) => `search:${r.type}:${r.sort}:${r.query}`, title: (r) => (r.query ? `Search: ${r.query}` : 'Search'), pane: 'list' },
    past: { key: (r) => `past:${r.day}`, title: (r) => `Past: ${r.day}`, pane: 'list' },
    comments: { key: () => 'comments', title: () => 'New Comments', pane: 'list' },
    from: { key: (r) => `from:${r.site}`, title: (r) => r.site, pane: 'list' },
};

function spec(current: Route): RouteSpec<Route> {
    return ROUTES[current.name] as RouteSpec<Route>;
}

export function routeKey(current: Route): string {
    return spec(current).key(current);
}

export function routeTitle(current: Route): string | undefined {
    return spec(current).title(current);
}

export function routePane(current: Route): Pane {
    return spec(current).pane;
}

export const route = signal<Route>(parseHash(location.hash));

const scrollPositions = new Map<string, number>();

/** Where the reader was on this page last time, for restoring after back/forward. */
export function savedScroll(key: string): number {
    return scrollPositions.get(key) ?? 0;
}

/*
 * Back/forward tracking. Each history entry Dusk creates is numbered (in `history.state`), so the
 * app knows whether Back stays inside Dusk; iOS gives installed apps no back button or gesture,
 * so Dusk offers its own.
 */
interface HistoryState {
    idx: number;
}

const ENTRIES_KEY = 'dusk:history';

function stateIndex(): number | undefined {
    const state = history.state as Partial<HistoryState> | null;
    return typeof state?.idx === 'number' ? state.idx : undefined;
}

/** The address of each numbered entry, so Back/Forward can still get there if the browser doesn't move. */
function storedEntries(): string[] {
    try {
        const parsed: unknown = JSON.parse(sessionStorage.getItem(ENTRIES_KEY) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
    } catch {
        return [];
    }
}

let entries = storedEntries();

const position = signal(((): { index: number; max: number } => {
    const index = stateIndex() ?? 0;
    if (stateIndex() === undefined) {
        history.replaceState({ idx: index } satisfies HistoryState, '');
    }
    entries[index] = location.hash;
    return { index, max: Math.max(index, entries.length - 1) };
})());

function setPosition(index: number, max: number): void {
    position.value = { index, max };
    entries = entries.slice(0, max + 1);
    entries[index] = location.hash;
    try {
        sessionStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    } catch {
        // Storage disabled: forward tracking resets on reload.
    }
}

export const canGoBack = computed(() => position.value.index > 0);
export const canGoForward = computed(() => position.value.index < position.value.max);

/** Where the current page sits in Dusk's own history (0 = the first page of this visit). */
export function historyIndex(): number {
    return position.peek().index;
}

/**
 * Move through history. If the browser doesn't (installed iOS apps can lose their history when
 * suspended), open the remembered page instead.
 */
function traverse(delta: -1 | 1): void {
    const from = position.peek().index;
    history.go(delta);
    window.setTimeout(() => {
        const target = entries[from + delta];
        if (position.peek().index === from && target !== undefined) {
            location.hash = target;
        }
    }, 400);
}

/** Back within Dusk; with nothing to go back to (opened from a link), go to the front page. */
export function goBack(): void {
    if (canGoBack.peek()) {
        traverse(-1);
    } else if (route.peek().name !== 'feed' || location.hash.length > 2) {
        location.hash = feedHref('top');
    }
}

export function goForward(): void {
    if (canGoForward.peek()) {
        traverse(1);
    }
}

/** Called just before the page changes, while the old page is still on screen, with its history index. */
const leaving: ((index: number) => void)[] = [];

export function onLeavePage(callback: (index: number) => void): void {
    leaving.push(callback);
}

/** Show `href` in place of the current page, without adding a history entry. */
export function replaceRoute(href: string): void {
    history.replaceState({ idx: position.peek().index } satisfies HistoryState, '', href);
    entries[position.peek().index] = location.hash;
    route.value = parseHash(location.hash);
}

history.scrollRestoration = 'manual';
window.addEventListener('hashchange', () => {
    // Save before changing the route: the new page renders (and scrolls) as soon as this returns.
    scrollPositions.set(routeKey(route.value), window.scrollY);
    for (const callback of leaving) {
        callback(position.peek().index);
    }
    const index = stateIndex();
    if (index === undefined) {
        // A new entry (a link or a typed address): number it. Anything that was ahead is gone.
        const next = position.peek().index + 1;
        history.replaceState({ idx: next } satisfies HistoryState, '');
        setPosition(next, next);
    } else {
        setPosition(index, Math.max(index, position.peek().max));
    }
    route.value = parseHash(location.hash);
});
