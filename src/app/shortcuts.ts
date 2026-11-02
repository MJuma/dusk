import { keyFor } from './keymap';
import type { KeyScope } from './keymap';

export interface Shortcut {
    commands: readonly string[];
    label: string;
    scope: KeyScope;
}

/** The Keyboard Shortcuts page, by command; the keys come from the key map so they can't drift apart. */
const LIST: readonly Shortcut[] = [
    { commands: ['next-thread', 'prev-thread'], label: 'Next / previous top-level comment', scope: 'thread' },
    { commands: ['next-comment', 'prev-comment'], label: 'Next / previous comment', scope: 'thread' },
    { commands: ['next-new', 'prev-new'], label: 'Next / previous new comment', scope: 'thread' },
    { commands: ['parent'], label: 'Parent', scope: 'thread' },
    { commands: ['root'], label: 'Root (top-level comment)', scope: 'thread' },
    { commands: ['toggle'], label: 'Collapse / expand', scope: 'thread' },
    { commands: ['skim'], label: 'Collapse / expand all threads', scope: 'thread' },
    { commands: ['search'], label: 'Search', scope: 'global' },
    { commands: ['settings'], label: 'Settings', scope: 'global' },
];

export const SHORTCUTS = LIST.map((shortcut) => ({
    ...shortcut,
    keys: shortcut.commands.map((command) => keyFor(shortcut.scope, command) ?? '?'),
}));
