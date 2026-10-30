import { useLayoutEffect } from 'preact/hooks';

import { FeedView } from '../feed/FeedView';
import { ThreadView } from '../thread/ThreadView';
import { UserView } from '../user/UserView';
import { refresh } from './refresh';
import { FEEDS, feedHref, route, routeKey, savedScroll } from './router';
import { settingsOpen } from './settings';
import { SettingsDialog } from './SettingsDialog';
import { dismissToast, toast } from './toast';

const LABELS = { top: 'Top', new: 'New', best: 'Best', ask: 'Ask', show: 'Show', jobs: 'Jobs' } as const;

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
            {current.action && (
                <a class="toast-action" href={current.action.href} target="_blank" rel="noopener" onClick={dismissToast}>
                    {current.action.label}
                </a>
            )}
            <button type="button" class="toast-close" aria-label="Dismiss" onClick={dismissToast}>
                ×
            </button>
        </output>
    );
}

export function App() {
    const current = route.value;
    const key = routeKey(current);

    useLayoutEffect(() => restoreScroll(savedScroll(key)), [key]);

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
            {current.name === 'item' && <ThreadView key={key} id={current.id} focus={current.focus} />}
            {current.name === 'user' && <UserView key={key} id={current.id} tab={current.tab} />}
            {current.name === 'feed' && <FeedView key={key} kind={current.kind} page={current.page} />}
            <SettingsDialog />
            <ToastView />
        </>
    );
}
