import { useCallback, useEffect, useRef } from 'preact/hooks';

import { settings, settingsOpen, updateSettings } from './settings';
import type { CommentsTarget, ContentWidth, IndentSize } from './settings';

interface Option {
    value: string;
    label: string;
}

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

    useEffect(() => {
        const element = dialog.current;
        if (open && element && !element.open) {
            element.showModal();
        } else if (!open && element?.open) {
            element.close();
        }
    }, [open]);

    return (
        <dialog ref={dialog} class="settings" aria-labelledby="settings-title" onClose={close}>
            <h2 id="settings-title">Settings</h2>
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
        </dialog>
    );
}
