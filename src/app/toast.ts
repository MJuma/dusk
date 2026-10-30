import { signal } from '@preact/signals';

export interface Toast {
    message: string;
    action?: { label: string; href: string };
}

/** A short notice at the bottom of the screen; one at a time. */
export const toast = signal<Toast | undefined>(undefined);

let timer = 0;

export function showToast(next: Toast, durationMs = 12_000): void {
    clearTimeout(timer);
    toast.value = next;
    timer = window.setTimeout(dismissToast, durationMs);
}

export function dismissToast(): void {
    clearTimeout(timer);
    toast.value = undefined;
}
