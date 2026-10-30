import { useLayoutEffect } from 'preact/hooks';

import { FeedView } from '../feed/FeedView';
import { ThreadView } from '../thread/ThreadView';
import { refresh } from './refresh';
import { FEEDS, feedHref, route } from './router';
import type { Route } from './router';
import { settingsOpen } from './settings';
import { SettingsDialog } from './SettingsDialog';

const LABELS = { top: 'Top', new: 'New', best: 'Best', ask: 'Ask', show: 'Show', jobs: 'Jobs' } as const;

const scrollMemory = new Map<string, number>();
let currentKey = '';

function routeKey(current: Route): string {
    return current.name === 'item' ? `item:${current.id}` : `feed:${current.kind}:${current.page}`;
}

const REFRESH_ICON = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
    </svg>
);
const SETTINGS_ICON = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
    </svg>
);

const openSettings = (): void => {
    settingsOpen.value = true;
};

window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName);
    if (event.key === '?' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        openSettings();
    }
});

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
                <button type="button" class="icon-btn" title="Refresh" aria-label="Refresh" onClick={refresh}>
                    {REFRESH_ICON}
                </button>
                <button type="button" class="icon-btn" title="Settings (?)" aria-label="Settings" onClick={openSettings}>
                    {SETTINGS_ICON}
                </button>
            </header>
            {current.name === 'item'
                ? <ThreadView key={key} id={current.id} />
                : <FeedView key={key} kind={current.kind} page={current.page} />}
            <SettingsDialog />
        </>
    );
}
