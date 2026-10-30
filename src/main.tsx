import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app/App';
import { showToast } from './app/toast';
import './styles/app.css';

render(<App />, document.getElementById('app') as HTMLElement);

const UPDATE_CHECK_MS = 30 * 60 * 1000;

if (import.meta.env.PROD) {
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
