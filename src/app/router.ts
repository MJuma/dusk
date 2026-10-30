import { signal } from '@preact/signals';

import type { FeedKind } from '../data/types';

export type Route =
    | { name: 'feed'; kind: FeedKind; page: number }
    | { name: 'item'; id: number };

export const FEEDS: readonly FeedKind[] = ['top', 'new', 'best', 'ask', 'show', 'jobs'];

export function parseHash(hash: string): Route {
    const [first, second] = hash.replace(/^#\/?/, '').split('/');
    if (first === 'item' && second && /^\d+$/.test(second)) {
        return { name: 'item', id: Number(second) };
    }
    const kind = FEEDS.find((feed) => feed === first) ?? 'top';
    const page = second && /^\d+$/.test(second) ? Math.max(0, Number(second) - 1) : 0;
    return { name: 'feed', kind, page };
}

export function feedHref(kind: FeedKind, page = 0): string {
    return page > 0 ? `#/${kind}/${page + 1}` : `#/${kind}`;
}

export function itemHref(id: number): string {
    return `#/item/${id}`;
}

export function routeKey(current: Route): string {
    return current.name === 'item' ? `item:${current.id}` : `feed:${current.kind}:${current.page}`;
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
