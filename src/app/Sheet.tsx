import type { ComponentChildren } from 'preact';
import { useCallback, useId } from 'preact/hooks';

import { CLOSE_ICON } from './icons';
import { useModalDialog } from './useModalDialog';

interface SheetProps {
    title: string;
    onClose: () => void;
    /** Show a Back button before the title; Escape goes back too instead of closing. */
    onBack?: () => void;
    /** Centered (the default), or at the bottom of the screen like an iOS action sheet. */
    placement?: 'center' | 'bottom';
    /** Content without padding, for lists that run edge to edge. */
    flush?: boolean;
    footer?: ComponentChildren;
    /** Between the title bar and the content, staying put while the content scrolls. */
    pinned?: ComponentChildren;
    /** Extra class on the panel. */
    class?: string;
    children: ComponentChildren;
}

const BACK_ICON = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
    </svg>
);

/**
 * A modal sheet: title bar with a close button, scrolling content and an optional footer. It's
 * open while mounted; render it conditionally. Escape, the close button, or a tap outside the
 * panel calls `onClose`.
 */
export function Sheet({ title, onClose, onBack, placement = 'center', flush = false, footer, pinned, class: extra, children }: SheetProps) {
    const dialog = useModalDialog(onClose);
    const titleId = useId();
    const onCancel = useCallback((event: Event) => {
        if (onBack) {
            event.preventDefault();
            onBack();
        }
    }, [onBack]);
    return (
        <dialog ref={dialog} class={placement === 'bottom' ? 'sheet sheet-bottom' : 'sheet'} aria-labelledby={titleId} onCancel={onCancel} onClose={onClose}>
            <div class={extra ? `sheet-panel ${extra}` : 'sheet-panel'} tabIndex={-1} data-autofocus>
                <header class="sheet-head">
                    {onBack && (
                        <button type="button" class="icon-btn sheet-back" aria-label="Back" onClick={onBack}>
                            {BACK_ICON}
                        </button>
                    )}
                    <h2 id={titleId}>{title}</h2>
                    <button type="button" class="icon-btn sheet-close" aria-label="Close" onClick={onClose}>
                        {CLOSE_ICON}
                    </button>
                </header>
                {pinned}
                {/* Keyed by title so a new page starts scrolled to the top. */}
                <div key={title} class={flush ? 'sheet-content sheet-flush' : 'sheet-content'}>
                    {children}
                </div>
                {footer && <footer class="sheet-foot">{footer}</footer>}
            </div>
        </dialog>
    );
}
