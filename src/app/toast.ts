import { signal } from '@preact/signals';

export interface Toast {
    message: string;
    /** A link to open, or a callback to run. */
    action?: { label: string; href: string } | { label: string; onClick: () => void };
}

/** A short notice at the bottom of the screen; one at a time. */
export const toast = signal<Toast | undefined>(undefined);

let timer = 0;

/** Shows a notice; `durationMs: null` keeps it until dismissed. */
export function showToast(next: Toast, durationMs: number | null = 12_000): void {
    clearTimeout(timer);
    toast.value = next;
    if (durationMs !== null) {
        timer = window.setTimeout(dismissToast, durationMs);
    }
}

export function dismissToast(): void {
    clearTimeout(timer);
    toast.value = undefined;
}
