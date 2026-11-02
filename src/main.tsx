import { render } from 'preact';

import { App } from './app/App';
import { hasTouch } from './app/device';
import { syncDocumentTitle } from './app/title';
import { showToast } from './app/toast';
import './styles/app.css';

syncDocumentTitle();
render(<App />, document.getElementById('app') as HTMLElement);

// Swipe gestures only matter on touch screens; load them after the first paint.
if (hasTouch()) {
    window.setTimeout(() => {
        import('./gestures/gestures').catch(() => undefined);
    }, 0);
}

const UPDATE_CHECK_MS = 30 * 60 * 1000;

/** Service worker registration and the "new version" prompt; not needed for the first paint. */
async function registerServiceWorker(): Promise<void> {
    const { registerSW } = await import('virtual:pwa-register');
    const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
            showToast({
                message: 'A new version of Dusk is ready.',
                action: {
                    label: 'Reload',
                    onClick: () => {
                        updateSW(true).catch(() => {
                            location.reload();
                        });
                    },
                },
            }, null);
        },
        // An installed app can stay open for days, so also check when it comes back to the foreground.
        onRegisteredSW(_url, registration) {
            if (!registration) {
                return;
            }
            const check = (): void => {
                if (navigator.onLine) {
                    registration.update().catch(() => undefined);
                }
            };
            window.setInterval(check, UPDATE_CHECK_MS);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    check();
                }
            });
        },
    });
}

if (import.meta.env.PROD) {
    window.setTimeout(() => {
        registerServiceWorker().catch(() => undefined);
    }, 0);
}
