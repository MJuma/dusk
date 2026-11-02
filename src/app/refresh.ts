import { signal } from '@preact/signals';

/** Bumped by the refresh button; views reload their data in place when it changes. */
export const refreshTick = signal(0);

export function refresh(): void {
    refreshTick.value += 1;
}

/** Loads in progress, so pull-to-refresh knows when the refresh it started has finished. */
export const loading = signal(0);

/** Count `work` as loading until it settles. */
export function tracked<T>(work: Promise<T>): Promise<T> {
    loading.value += 1;
    const settled = (): void => {
        loading.value -= 1;
    };
    work.then(settled, settled);
    return work;
}
