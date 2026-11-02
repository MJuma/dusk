import { signal } from '@preact/signals';

/** How many sheets (modal dialogs) are open. Page-level keys and gestures stand down while any is. */
export const openOverlays = signal(0);

export function overlayOpen(): boolean {
    return openOverlays.peek() > 0;
}
