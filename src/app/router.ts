import { signal } from '@preact/signals';

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

export function routeKey(current: Route): string {
    switch (current.name) {
        case 'item':
            return current.focus === undefined ? `item:${current.id}` : `item:${current.id}:${current.focus}`;
        case 'user':
            return `user:${current.id}:${current.tab}`;
        case 'feed':
            return `feed:${current.kind}:${current.page}`;
        case 'saved':
            return 'saved';
        case 'read':
            return `read:${current.id}`;
        case 'search':
            return `search:${current.type}:${current.sort}:${current.query}`;
        case 'past':
            return `past:${current.day}`;
        case 'comments':
            return 'comments';
        case 'from':
            return `from:${current.site}`;
    }
}

export const route = signal<Route>(parseHash(location.hash));

const scrollPositions = new Map<string, number>();

/** Where the reader was on this page last time, for restoring after back/forward. */
export function savedScroll(key: string): number {
    return scrollPositions.get(key) ?? 0;
}

history.scrollRestoration = 'manual';
window.addEventListener('hashchange', () => {
    // Save before changing the route: the new page renders (and scrolls) as soon as this returns.
    scrollPositions.set(routeKey(route.value), window.scrollY);
    route.value = parseHash(location.hash);
});
