import { signal } from '@preact/signals';

/** Whether the browser thinks it has a connection; drives offline fallbacks and the banner. */
export const online = signal(navigator.onLine);

window.addEventListener('online', () => {
    online.value = true;
});
window.addEventListener('offline', () => {
    online.value = false;
});
