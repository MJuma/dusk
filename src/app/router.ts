import { signal } from '@preact/signals';

import type { FeedKind } from '../data/types';

export type UserTab = 'submissions' | 'comments';

export type Route =
    | { name: 'feed'; kind: FeedKind; page: number }
    /** `focus` is a comment to jump to once the thread has loaded. */
    | { name: 'item'; id: number; focus?: number }
    | { name: 'user'; id: string; tab: UserTab };

export const FEEDS: readonly FeedKind[] = ['top', 'new', 'best', 'ask', 'show', 'jobs'];

const NUMBER = /^\d+$/;

export function parseHash(hash: string): Route {
    const [first, second, third] = hash.replace(/^#\/?/, '').split('/');
    if (first === 'item' && second && NUMBER.test(second)) {
        return third && NUMBER.test(third) ? { name: 'item', id: Number(second), focus: Number(third) } : { name: 'item', id: Number(second) };
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
