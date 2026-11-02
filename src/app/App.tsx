import { Fragment } from 'preact';
import { useLayoutEffect } from 'preact/hooks';

import { FeedView } from '../feed/FeedView';
import { saveSheet } from '../offline/saved';
import { ThreadView } from '../thread/ThreadView';
import { SAVED_ICON } from './icons';
import { wantsInstallNudge } from './install';
import { lazyComponent } from './lazy';
import { listRoute, splitActive } from './layout';
import { online } from './online';
import { refresh } from './refresh';
import { COMMENTS_HREF, feedHref, pastHref, route, routeKey, routePane, SAVED_HREF, savedScroll, searchHref } from './router';
import type { Route } from './router';
import { useKeyScope } from './keymap';
import { settingsOpen } from './settings';
import { dismissToast, toast } from './toast';

// Secondary pages and dialogs load on first use so the feed and threads stay small.
const LOADING = <main class="status">Loading…</main>;
const SearchView = lazyComponent(() => import('../listing/ListingViews').then((m) => m.SearchView), LOADING);
const PastView = lazyComponent(() => import('../listing/ListingViews').then((m) => m.PastView), LOADING);
const NewCommentsView = lazyComponent(() => import('../listing/ListingViews').then((m) => m.NewCommentsView), LOADING);
const FromView = lazyComponent(() => import('../listing/ListingViews').then((m) => m.FromView), LOADING);
const UserView = lazyComponent(() => import('../user/UserView').then((m) => m.UserView), LOADING);
const SavedView = lazyComponent(() => import('../offline/SavedView').then((m) => m.SavedView), LOADING);
const ArticleView = lazyComponent(() => import('../offline/ArticleView').then((m) => m.ArticleView), LOADING);
const SettingsDialog = lazyComponent(() => import('./SettingsDialog').then((m) => m.SettingsDialog));
const SaveSheet = lazyComponent(() => import('../offline/SaveSheet').then((m) => m.SaveSheet));
const InstallNudge = lazyComponent(() => import('./InstallNudge').then((m) => m.InstallNudge));

interface Tab {
    key: string;
    label: string;
    href: string;
}

/** HN's top navigation: the feeds plus "past" and newest "comments". */
const TABS: readonly Tab[] = [
    { key: 'feed:top', label: 'Top', href: feedHref('top') },
    { key: 'feed:new', label: 'New', href: feedHref('new') },
    { key: 'feed:best', label: 'Best', href: feedHref('best') },
    { key: 'past', label: 'Past', href: pastHref() },
    { key: 'comments', label: 'Comments', href: COMMENTS_HREF },
    { key: 'feed:ask', label: 'Ask', href: feedHref('ask') },
    { key: 'feed:show', label: 'Show', href: feedHref('show') },
    { key: 'feed:jobs', label: 'Jobs', href: feedHref('jobs') },
];

function activeTab(current: Route): string | undefined {
    if (current.name === 'feed') {
        return `feed:${current.kind}`;
    }
    return current.name === 'past' || current.name === 'comments' ? current.name : undefined;
}

const SEARCH_ICON = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.5-4.5" />
    </svg>
);

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

const onGlobalKey = (command: string): void => {
    if (command === 'settings') {
        openSettings();
    } else if (route.value.name === 'search') {
        document.querySelector<HTMLInputElement>('.search-input')?.focus();
    } else {
        location.hash = searchHref();
    }
};

const RESTORE_TIMEOUT_MS = 5000;

/**
 * Scrolls back to where the reader was. If the page is still loading and too short, keeps trying
 * as it grows, until the position is reached, the reader scrolls themselves, or time runs out.
 */
function restoreScroll(target: number): (() => void) | undefined {
    window.scrollTo(0, target);
    if (window.scrollY >= target - 1) {
        return undefined;
    }
    const observer = new ResizeObserver(() => {
        window.scrollTo(0, target);
        if (window.scrollY >= target - 1) {
            stop();
        }
    });
    const timer = window.setTimeout(() => {
        stop();
    }, RESTORE_TIMEOUT_MS);
    const userEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    function stop(): void {
        observer.disconnect();
        clearTimeout(timer);
        for (const type of userEvents) {
            window.removeEventListener(type, stop);
        }
    }
    observer.observe(document.body);
    for (const type of userEvents) {
        window.addEventListener(type, stop, { passive: true });
    }
    return stop;
}

function ToastView() {
    const current = toast.value;
    if (!current) {
        return null;
    }
    return (
        <output class="toast">
            <span>{current.message}</span>
            {current.action && 'href' in current.action && (
                <a class="toast-action" href={current.action.href} target="_blank" rel="noopener" onClick={dismissToast}>
                    {current.action.label}
                </a>
            )}
            {current.action && 'onClick' in current.action && (
                <button type="button" class="toast-action" onClick={current.action.onClick}>
                    {current.action.label}
                </button>
            )}
            <button type="button" class="toast-close" aria-label="Dismiss" onClick={dismissToast}>
                ×
            </button>
        </output>
    );
}

/** A page's view, keyed so each page (and each visit to a different one) gets its own state. */
function renderPage(page: Route) {
    const key = routeKey(page);
    switch (page.name) {
        case 'item':
            // Keyed by story only: following a comment's permalink within the thread just jumps to it.
            return <ThreadView key={`item:${page.id}`} id={page.id} focus={page.focus} />;
        case 'user':
            return <UserView key={key} id={page.id} tab={page.tab} />;
        case 'feed':
            return (
                <Fragment key={key}>
                    {wantsInstallNudge() && <InstallNudge />}
                    <FeedView kind={page.kind} page={page.page} />
                </Fragment>
            );
        case 'saved':
            return <SavedView key={key} />;
        case 'read':
            return <ArticleView key={key} id={page.id} />;
        case 'search':
            return <SearchView key={key} query={page.query} type={page.type} sort={page.sort} />;
        case 'past':
            return <PastView key={key} day={page.day} />;
        case 'comments':
            return <NewCommentsView key={key} />;
        case 'from':
            return <FromView key={key} site={page.site} />;
    }
}

export function App() {
    const current = route.value;
    const key = routeKey(current);
    useKeyScope('global', onGlobalKey);

    const split = splitActive.value;
    const pane = routePane(current);
    // In split view a list scrolls in its own pane; the page itself scrolls the story beside it.
    // Restore only when the view changes: a permalink within the open thread scrolls to its comment itself.
    const viewKey = current.name === 'item' ? `item:${current.id}` : key;
    useLayoutEffect(() => restoreScroll(splitActive.peek() && routePane(route.peek()) === 'list' ? 0 : savedScroll(routeKey(route.peek()))), [viewKey]);

    const active = activeTab(current);
    return (
        <>
            <header class="topbar">
                <a class="brand" href={feedHref('top')}>
                    Dusk
                </a>
                <nav class="tabs" aria-label="Sections">
                    {TABS.map((tab) => (
                        <a key={tab.key} class="tab" href={tab.href} aria-current={tab.key === active ? 'page' : undefined}>
                            {tab.label}
                        </a>
                    ))}
                </nav>
                <a class="icon-btn" href={searchHref()} title="Search (/)" aria-label="Search" aria-current={current.name === 'search' ? 'page' : undefined}>
                    {SEARCH_ICON}
                </a>
                <a class="icon-btn" href={SAVED_HREF} title="Saved for offline" aria-label="Saved for offline" aria-current={current.name === 'saved' ? 'page' : undefined}>
                    {SAVED_ICON}
                </a>
                <button type="button" class="icon-btn" title="Refresh" aria-label="Refresh" onClick={refresh}>
                    {REFRESH_ICON}
                </button>
                <button type="button" class="icon-btn" title="Settings (?)" aria-label="Settings" onClick={openSettings}>
                    {SETTINGS_ICON}
                </button>
            </header>
            {/* Everything below the top bar; the back/forward swipe slides this. */}
            <div class="page">
                {!online.value && (
                    <p class="offline-banner">
                        Offline · saved stories still open. <a href={SAVED_HREF}>Saved</a>
                    </p>
                )}
                {split
                    ? (
                        <div class="split">
                            <div class="split-list">{renderPage(pane === 'list' ? current : listRoute.value)}</div>
                            <div class="split-detail">
                                {pane === 'detail' ? renderPage(current) : <p class="status">Choose a story to read it here.</p>}
                            </div>
                        </div>
                    )
                    : renderPage(current)}
            </div>
            {settingsOpen.value && <SettingsDialog />}
            {saveSheet.value && <SaveSheet />}
            <ToastView />
        </>
    );
}
