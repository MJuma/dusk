import { signal } from '@preact/signals';

import { isInstalledApp, isIos } from './device';

/** Chromium's install prompt event (not in TypeScript's DOM types). */
export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
}

export const DISMISSED_KEY = 'dusk:install-dismissed';

/**
 * Chromium fires its install prompt once, early, so this listener lives in the main bundle; the
 * hint that uses it loads on demand.
 */
export const installPrompt = signal<BeforeInstallPromptEvent | undefined>(undefined);

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt.value = event as BeforeInstallPromptEvent;
});
window.addEventListener('appinstalled', () => {
    installPrompt.value = undefined;
});

export function wasDismissed(): boolean {
    try {
        return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
        return false;
    }
}

/** Whether to load the install hint at all: never in the installed app or once dismissed. */
export function wantsInstallNudge(): boolean {
    return !isInstalledApp() && !wasDismissed() && (installPrompt.value !== undefined || isIos());
}
