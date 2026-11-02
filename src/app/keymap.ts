import { useEffect, useRef } from 'preact/hooks';

import { overlayOpen } from './overlay';

export type KeyScope = 'global' | 'thread';

/** Each key and the command it runs, by scope. Labels for the Shortcuts page are in `shortcuts.ts`. */
const BINDINGS: Record<KeyScope, Record<string, string>> = {
    thread: {
        'n': 'next-thread',
        'p': 'prev-thread',
        'j': 'next-comment',
        'k': 'prev-comment',
        'N': 'next-new',
        'P': 'prev-new',
        'u': 'parent',
        'r': 'root',
        'c': 'toggle',
        's': 'skim',
    },
    global: { '/': 'search', '?': 'settings' },
};

const COMMANDS = new Map<string, { scope: KeyScope; command: string }>();
for (const scope of Object.keys(BINDINGS) as KeyScope[]) {
    for (const [key, command] of Object.entries(BINDINGS[scope])) {
        COMMANDS.set(key, { scope, command });
    }
}

/** The key bound to a command, for the Shortcuts page. */
export function keyFor(scope: KeyScope, command: string): string | undefined {
    return Object.entries(BINDINGS[scope]).find(([, bound]) => bound === command)?.[0];
}

const handlers = new Map<KeyScope, (command: string) => void>();

function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || overlayOpen() || isTyping(event.target)) {
        return;
    }
    const match = COMMANDS.get(event.key);
    const handler = match && handlers.get(match.scope);
    if (match && handler) {
        event.preventDefault();
        handler(match.command);
    }
});

/** Handle a scope's shortcuts while the calling component is mounted. */
export function useKeyScope(scope: KeyScope, handler: (command: string) => void): void {
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    });
    useEffect(() => {
        const dispatch = (command: string): void => {
            handlerRef.current(command);
        };
        handlers.set(scope, dispatch);
        return () => {
            if (handlers.get(scope) === dispatch) {
                handlers.delete(scope);
            }
        };
    }, [scope]);
}
