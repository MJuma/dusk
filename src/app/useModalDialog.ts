import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';

import { openOverlays } from './overlay';

/** A press that moves further than this is a drag, not a tap. */
const TAP_SLOP_PX = 10;

function swallow(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
}

/**
 * Shows a modal <dialog> while the calling component is mounted, and calls `onClose` when it's
 * dismissed: Escape, or a tap that starts and ends on the dialog element itself. Sheets stretch
 * the dialog over the whole screen with the visible panel inside, so a tap outside the panel
 * lands on the dialog (iOS doesn't deliver taps on `::backdrop`), and requiring the press to start
 * there too keeps a text selection that ends outside the panel from closing it.
 */
export function useModalDialog(onClose: () => void) {
    const dialog = useRef<HTMLDialogElement>(null);
    const onCloseRef = useRef(onClose);
    useLayoutEffect(() => {
        onCloseRef.current = onClose;
    });

    useLayoutEffect(() => {
        const element = dialog.current;
        if (!element) {
            return undefined;
        }
        element.showModal();
        // Focus the panel rather than its first button, so no focus ring shows on open.
        element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
        openOverlays.value += 1;
        return () => {
            openOverlays.value -= 1;
            // Closing before the element is removed lets the browser restore focus to the opener.
            if (element.open) {
                element.close();
            }
        };
    }, []);

    useEffect(() => {
        const element = dialog.current;
        if (!element) {
            return undefined;
        }
        // Decide from the pointer itself, not the click: on touch screens WebKit moves a tap's
        // click to the nearest control, so a tap just outside the panel would click its header or
        // footer instead. The click that follows a dismissing tap is swallowed, so it can't reach
        // whatever is under the sheet once it's gone.
        let press: { x: number; y: number } | undefined;
        const swallowNextClick = (): void => {
            window.addEventListener('click', swallow, { capture: true, once: true });
            window.setTimeout(() => {
                window.removeEventListener('click', swallow, { capture: true });
            }, 600);
        };
        const onPointerDown = (event: PointerEvent): void => {
            press = event.target === element ? { x: event.clientX, y: event.clientY } : undefined;
        };
        const onPointerUp = (event: PointerEvent): void => {
            const start = press;
            press = undefined;
            if (start && event.target === element && Math.hypot(event.clientX - start.x, event.clientY - start.y) < TAP_SLOP_PX) {
                swallowNextClick();
                onCloseRef.current();
            }
        };
        const onPointerCancel = (): void => {
            press = undefined;
        };
        // iOS scrolls the page behind a sheet when a drag can't scroll anything in it (a short menu,
        // the title bar). Only let drags through where the sheet's content can scroll, or on controls.
        const onTouchMove = (event: TouchEvent): void => {
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest('input, select, textarea')) {
                return;
            }
            const scroller = target?.closest<HTMLElement>('.sheet-content');
            if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 1) {
                event.preventDefault();
            }
        };
        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointerup', onPointerUp);
        element.addEventListener('pointercancel', onPointerCancel);
        element.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => {
            element.removeEventListener('touchmove', onTouchMove);
            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('pointerup', onPointerUp);
            element.removeEventListener('pointercancel', onPointerCancel);
        };
    }, []);

    return dialog;
}
