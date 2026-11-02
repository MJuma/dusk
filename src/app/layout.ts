import { computed, effect, signal } from '@preact/signals';

import { feedHref, parseHash, route, routePane } from './router';
import type { Route } from './router';
import { settings } from './settings';

/** Split view needs room for two columns. */
const wideQuery = matchMedia('(min-width: 900px)');
const wideScreen = signal(wideQuery.matches);
wideQuery.addEventListener('change', (event) => {
    wideScreen.value = event.matches;
});

/** Stories and the open story side by side (Settings › Appearance › Split View) on a wide screen. */
export const splitActive = computed(() => settings.value.splitView && wideScreen.value);

const LIST_KEY = 'dusk:split-list';

function storedList(): Route {
    try {
        const hash = sessionStorage.getItem(LIST_KEY);
        const parsed = hash ? parseHash(hash) : undefined;
        return parsed && routePane(parsed) === 'list' ? parsed : parseHash(feedHref('top'));
    } catch {
        return parseHash(feedHref('top'));
    }
}

/** The list shown in split view's left pane: the last list page visited (the front page at first). */
export const listRoute = signal<Route>(routePane(route.peek()) === 'list' ? route.peek() : storedList());

effect(() => {
    const current = route.value;
    if (routePane(current) === 'list') {
        listRoute.value = current;
        try {
            sessionStorage.setItem(LIST_KEY, location.hash);
        } catch {
            // Storage disabled: the left pane starts at the front page after a reload.
        }
    }
});
