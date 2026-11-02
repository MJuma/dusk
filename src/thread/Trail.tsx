import { memo } from '../lib/memo';
import { useCallback, useLayoutEffect, useRef } from 'preact/hooks';

import type { ThreadComment } from '../data/types';

interface TrailProps {
    /** The comment at the reading line and its ancestors, top-level first; empty above the comments. */
    chain: readonly ThreadComment[];
    topLevelCount: number;
    skimmed: boolean;
    onJump: (id: number) => void;
    onSkim: () => void;
}

/**
 * The sticky "you are here" bar: which top-level thread you're in and the chain of replies down to
 * the comment you're reading, each in its level's rail color. Tap a name to jump to that comment.
 */
export const Trail = memo(function Trail({ chain, topLevelCount, skimmed, onJump, onSkim }: TrailProps) {
    const listRef = useRef<HTMLOListElement>(null);
    const jump = useCallback((event: Event) => {
        onJump(Number((event.currentTarget as HTMLElement).dataset['target']));
    }, [onJump]);

    // Keep the deepest (current) comment in view when the chain is wider than the screen.
    useLayoutEffect(() => {
        const element = listRef.current;
        if (element) {
            element.scrollLeft = element.scrollWidth;
        }
    }, [chain]);

    const root = chain[0];
    return (
        <nav class="trail" aria-label="Where you are in the thread">
            <ol ref={listRef} class="trail-chain">
                {root
                    ? (
                        <li class="trail-pos">
                            {root.topLevelIndex + 1}/{topLevelCount}
                        </li>
                    )
                    : <li class="trail-pos">{topLevelCount} threads</li>}
                {chain.map((comment) => (
                    <li key={comment.id}>
                        <button
                            type="button"
                            class={comment === chain.at(-1) ? 'trail-chip trail-current' : 'trail-chip'}
                            data-target={comment.id}
                            data-hue={comment.depth % 8}
                            onClick={jump}
                        >
                            {comment.author || '[deleted]'}
                        </button>
                    </li>
                ))}
            </ol>
            <button type="button" class="trail-skim" title="Collapse or expand all threads (s)" onClick={onSkim}>
                {skimmed ? 'Expand all' : 'Collapse all'}
            </button>
        </nav>
    );
});
