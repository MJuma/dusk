import { effect, signal } from '@preact/signals';

import { route, routeKey, routeTitle } from './router';
import type { Route } from './router';

const APP = 'Dusk';

/** A title supplied by the page itself once its data loads (e.g. the story's title), for one route. */
interface PageTitle {
    key: string;
    text: string;
}

const pageTitle = signal<PageTitle | undefined>(undefined);

/** Title the current page after what it shows, once that is known. */
export function setPageTitle(text: string | undefined): void {
    const trimmed = text?.trim();
    pageTitle.value = trimmed ? { key: routeKey(route.peek()), text: trimmed } : undefined;
}

/** The document title for a route, like HN's "<story title> | Hacker News". */
export function titleFor(current: Route, supplied?: PageTitle): string {
    let text = routeTitle(current);
    // A title supplied for an earlier page never sticks to the next one.
    if (supplied && supplied.key === routeKey(current)) {
        text = supplied.text;
    }
    return text ? `${text} | ${APP}` : APP;
}

/** Keep `document.title` in step with the route and any title the page has supplied. */
export function syncDocumentTitle(): () => void {
    return effect(() => {
        document.title = titleFor(route.value, pageTitle.value);
    });
}
