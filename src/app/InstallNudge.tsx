import { signal } from '@preact/signals';
import { useCallback, useState } from 'preact/hooks';

import { isInstalledApp } from './settings';

/** Chromium's install prompt event (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
}

const DISMISSED_KEY = 'dusk:install-dismissed';
const installPrompt = signal<BeforeInstallPromptEvent | undefined>(undefined);

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt.value = event as BeforeInstallPromptEvent;
});
window.addEventListener('appinstalled', () => {
    installPrompt.value = undefined;
});

function isIos(): boolean {
    // iPadOS reports itself as a Mac; touch support tells them apart.
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function wasDismissed(): boolean {
    try {
        return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
        return false;
    }
}

const SHARE_ICON = (
    <svg class="install-share" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
    </svg>
);

/**
 * Suggests installing Dusk: on iPhone, Safari can't prompt, so explain Share → Add to Home Screen
 * (which also keeps saved stories from being evicted); Chromium browsers get an Install button.
 */
export function InstallNudge() {
    const [dismissed, setDismissed] = useState(wasDismissed);
    const prompt = installPrompt.value;

    const dismiss = useCallback(() => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISSED_KEY, '1');
        } catch {
            // Storage disabled: hide for this session only.
        }
    }, []);
    const install = useCallback(() => {
        prompt?.prompt().catch(() => undefined);
        installPrompt.value = undefined;
    }, [prompt]);

    const ios = isIos();
    if (dismissed || isInstalledApp() || (!prompt && !ios)) {
        return null;
    }
    return (
        <aside class="install-nudge" aria-label="Install Dusk">
            {ios
                ? <span>Install Dusk: tap {SHARE_ICON} Share, then “Add to Home Screen”. It opens full screen and keeps saved stories.</span>
                : <span>Install Dusk as an app for its own window and offline reading.</span>}
            {prompt && (
                <button type="button" class="toast-action" onClick={install}>
                    Install
                </button>
            )}
            <button type="button" class="toast-close" aria-label="Dismiss" onClick={dismiss}>
                ×
            </button>
        </aside>
    );
}
