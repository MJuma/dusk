import { memo } from '../lib/memo';
import { useCallback } from 'preact/hooks';

import type { Command } from './navigation';

interface ThreadNavProps {
    /** 1-based top-level comment at the reading line; 0 above the comments. */
    current: number;
    total: number;
    newCount: number;
    onCommand: (command: Command) => void;
}

const UP = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 15l6-6 6 6" />
    </svg>
);
const DOWN = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
    </svg>
);

export const ThreadNav = memo(function ThreadNav({ current, total, newCount, onCommand }: ThreadNavProps) {
    const handle = useCallback((event: Event) => {
        onCommand((event.currentTarget as HTMLElement).dataset['command'] as Command);
    }, [onCommand]);

    if (total === 0) {
        return null;
    }
    return (
        <nav class="thread-nav" aria-label="Comment navigation">
            <button type="button" class="nav-btn" data-command="prev-thread" title="Previous top-level comment (p)" aria-label="Previous top-level comment" onClick={handle}>
                {UP}
            </button>
            <span class="nav-pos">{current > 0 ? `${current} / ${total}` : `${total} threads`}</span>
            <button type="button" class="nav-btn" data-command="next-thread" title="Next top-level comment (n)" aria-label="Next top-level comment" onClick={handle}>
                {DOWN}
            </button>
            {newCount > 0 && (
                <button type="button" class="nav-btn nav-new" data-command="next-new" title="Next new comment (Shift+N)" onClick={handle}>
                    {newCount} new
                </button>
            )}
        </nav>
    );
});
