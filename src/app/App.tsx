import { useLayoutEffect } from 'preact/hooks';

import { FeedView } from '../feed/FeedView';
import { ThreadView } from '../thread/ThreadView';
import { FEEDS, feedHref, route } from './router';
import type { Route } from './router';

const LABELS = { top: 'Top', new: 'New', best: 'Best', ask: 'Ask', show: 'Show', jobs: 'Jobs' } as const;

const scrollMemory = new Map<string, number>();
let currentKey = '';

function routeKey(current: Route): string {
    return current.name === 'item' ? `item:${current.id}` : `feed:${current.kind}:${current.page}`;
}

history.scrollRestoration = 'manual';
window.addEventListener('hashchange', (event) => {
    scrollMemory.set(currentKey, window.scrollY);
    // Opening a link to the current item (e.g. from a comment) should not jump back to a saved spot.
    if (new URL(event.newURL).hash === new URL(event.oldURL).hash) {
        scrollMemory.delete(currentKey);
    }
});

export function App() {
    const current = route.value;
    const key = routeKey(current);

    useLayoutEffect(() => {
        currentKey = key;
        window.scrollTo(0, scrollMemory.get(key) ?? 0);
    }, [key]);

    const activeFeed = current.name === 'feed' ? current.kind : undefined;
    return (
        <>
            <header class="topbar">
                <a class="brand" href={feedHref('top')}>
                    Dusk
                </a>
                <nav class="tabs" aria-label="Feeds">
                    {FEEDS.map((kind) => (
                        <a key={kind} class="tab" href={feedHref(kind)} aria-current={kind === activeFeed ? 'page' : undefined}>
                            {LABELS[kind]}
                        </a>
                    ))}
                </nav>
            </header>
            {current.name === 'item'
                ? <ThreadView key={key} id={current.id} />
                : <FeedView key={key} kind={current.kind} page={current.page} />}
        </>
    );
}
