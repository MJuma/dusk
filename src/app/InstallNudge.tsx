import { useCallback, useState } from 'preact/hooks';

import { isIos } from './device';
import { DISMISSED_KEY, installPrompt, wasDismissed } from './install';

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
    if (dismissed || (!prompt && !ios)) {
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
