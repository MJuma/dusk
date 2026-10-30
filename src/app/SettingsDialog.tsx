import { useCallback, useEffect, useLayoutEffect, useRef } from 'preact/hooks';

import { settings, settingsOpen, updateSettings } from './settings';
import type { CommentsTarget, ContentWidth, IndentSize, Theme, Thumbnails } from './settings';

interface Option {
    value: string;
    label: string;
    /** Shows a preview chip in this theme's colors. */
    swatch?: boolean;
}

const THEME_OPTIONS: readonly Option[] = [
    { value: 'system', label: 'System (Dusk or Light)', swatch: true },
    { value: 'dusk', label: 'Dusk', swatch: true },
    { value: 'dark-reader', label: 'Dark Reader', swatch: true },
    { value: 'dim', label: 'Dim', swatch: true },
    { value: 'black', label: 'Black (OLED)', swatch: true },
    { value: 'light', label: 'Light', swatch: true },
];
const THUMBNAIL_OPTIONS: readonly Option[] = [
    { value: 'images', label: 'Article images (site icon when there is none)' },
    { value: 'icons', label: 'Site icons only' },
    { value: 'off', label: 'Off' },
];

const COMMENTS_OPTIONS: readonly Option[] = [
    { value: 'auto', label: 'Auto: new tab on a laptop, same view on a phone' },
    { value: 'same', label: 'Same tab' },
    { value: 'new', label: 'New tab' },
];
const WIDTH_OPTIONS: readonly Option[] = [
    { value: 'wide', label: 'Wide (85%, like HN)' },
    { value: 'full', label: 'Full width' },
    { value: 'narrow', label: 'Narrow' },
];
const INDENT_OPTIONS: readonly Option[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'normal', label: 'Normal' },
    { value: 'wide', label: 'Wide (like HN)' },
];
const SHORTCUTS: readonly [string, string][] = [
    ['n / p', 'Next / previous top-level comment'],
    ['j / k', 'Next / previous comment'],
    ['N / P', 'Next / previous new comment'],
    ['u', 'Parent'],
    ['r', 'Root (top-level comment)'],
    ['c', 'Collapse / expand'],
    ['?', 'This panel'],
];

const CLOSE_ICON = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>
);

const setTheme = (value: string): void => {
    updateSettings({ theme: value as Theme });
};
const setThumbnails = (value: string): void => {
    updateSettings({ thumbnails: value as Thumbnails });
};
const setCommentsTarget = (value: string): void => {
    updateSettings({ commentsTarget: value as CommentsTarget });
};
const setWidth = (value: string): void => {
    updateSettings({ width: value as ContentWidth });
};
const setIndent = (value: string): void => {
    updateSettings({ indent: value as IndentSize });
};
const close = (): void => {
    settingsOpen.value = false;
};

interface ChoiceProps {
    legend: string;
    name: string;
    value: string;
    options: readonly Option[];
    onChange: (value: string) => void;
}

function Choice({ legend, name, value, options, onChange }: ChoiceProps) {
    const handle = useCallback((event: Event) => {
        onChange((event.currentTarget as HTMLInputElement).value);
    }, [onChange]);
    return (
        <fieldset class="choice">
            <legend>{legend}</legend>
            {options.map((option) => (
                <label key={option.value} class="choice-option">
                    <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={handle} />
                    {option.swatch && <span class="swatch" data-swatch={option.value} aria-hidden="true">Aa</span>}
                    {option.label}
                </label>
            ))}
        </fieldset>
    );
}

export function SettingsDialog() {
    const dialog = useRef<HTMLDialogElement>(null);
    const open = settingsOpen.value;
    const current = settings.value;

    useLayoutEffect(() => {
        const element = dialog.current;
        if (open && element && !element.open) {
            element.showModal();
        } else if (!open && element?.open) {
            element.close();
        }
    }, [open]);

    // Clicking the backdrop closes the panel. The panel's content fills the <dialog>, so only
    // backdrop clicks target the <dialog> itself; requiring the press to start there too keeps a
    // text selection that ends outside the panel from closing it.
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
                close();
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

    return (
        <dialog ref={dialog} class="settings" aria-labelledby="settings-title" onClose={close}>
            <div class="settings-body">
                <header class="settings-head">
                    <h2 id="settings-title">Settings</h2>
                    <button type="button" class="icon-btn settings-close" aria-label="Close settings" onClick={close}>
                        {CLOSE_ICON}
                    </button>
                </header>
                <Choice legend="Theme" name="theme" value={current.theme} options={THEME_OPTIONS} onChange={setTheme} />
                <Choice legend="Thumbnails" name="thumbnails" value={current.thumbnails} options={THUMBNAIL_OPTIONS} onChange={setThumbnails} />
                <Choice legend="Open comments in" name="comments-target" value={current.commentsTarget} options={COMMENTS_OPTIONS} onChange={setCommentsTarget} />
                <Choice legend="Content width (laptop)" name="width" value={current.width} options={WIDTH_OPTIONS} onChange={setWidth} />
                <Choice legend="Reply indent" name="indent" value={current.indent} options={INDENT_OPTIONS} onChange={setIndent} />
                <h3>Keyboard shortcuts in a thread</h3>
                <dl class="shortcuts">
                    {SHORTCUTS.map(([keys, action]) => (
                        <div key={keys}>
                            <dt>{keys}</dt>
                            <dd>{action}</dd>
                        </div>
                    ))}
                </dl>
                <button type="button" class="settings-done" onClick={close}>
                    Done
                </button>
            </div>
        </dialog>
    );
}
