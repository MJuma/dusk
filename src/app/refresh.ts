import { signal } from '@preact/signals';

/** Bumped by the refresh button; views reload their data in place when it changes. */
export const refreshTick = signal(0);

export function refresh(): void {
    refreshTick.value += 1;
}
