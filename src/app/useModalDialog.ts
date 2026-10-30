import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';

/**
 * Drives a modal <dialog> from state: opens and closes it, and closes it on a backdrop click.
 * The dialog's content should fill it (no padding on the <dialog> itself) so that only backdrop
 * clicks target the <dialog> element; requiring the press to start there too keeps a text
 * selection that ends outside the dialog from closing it.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
    const dialog = useRef<HTMLDialogElement>(null);
    const onCloseRef = useRef(onClose);
    useLayoutEffect(() => {
        onCloseRef.current = onClose;
    });

    useLayoutEffect(() => {
        const element = dialog.current;
        if (open && element && !element.open) {
            element.showModal();
        } else if (!open && element?.open) {
            element.close();
        }
    }, [open]);

    useEffect(() => {
        const element = dialog.current;
        if (!element) {
            return undefined;
        }
        let pressedBackdrop = false;
        const onPointerDown = (event: PointerEvent): void => {
            pressedBackdrop = event.target === element;
        };
        const onClick = (event: MouseEvent): void => {
            if (pressedBackdrop && event.target === element) {
                onCloseRef.current();
            }
            pressedBackdrop = false;
        };
        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('click', onClick);
        return () => {
            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('click', onClick);
        };
    }, []);

    return dialog;
}
