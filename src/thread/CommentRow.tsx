import { memo } from 'preact/compat';
import { useCallback, useMemo } from 'preact/hooks';

import { hnItemUrl, hnReplyUrl } from '../data/hn';
import type { ThreadComment } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';
import { timeAgo } from '../lib/time';

interface CommentRowProps {
    comment: ThreadComment;
    storyId: number;
    isOp: boolean;
    collapsed: boolean;
    onToggle: (id: number) => void;
}

export const CommentRow = memo(function CommentRow({ comment, storyId, isOp, collapsed, onToggle }: CommentRowProps) {
    const body = useMemo(() => ({ __html: sanitizeHnHtml(comment.html) }), [comment.html]);
    const style = useMemo(() => ({ '--d': comment.depth }), [comment.depth]);
    const toggle = useCallback((): void => {
        onToggle(comment.id);
    }, [onToggle, comment.id]);
    return (
        <article
            class={`c${comment.depth === 0 ? ' c-top' : ''}${collapsed ? ' c-collapsed' : ''}`}
            id={`c${comment.id}`}
            style={style}
        >
            <header class="c-head">
                <button class="c-toggle" type="button" aria-expanded={!collapsed} onClick={toggle}>
                    {collapsed ? `[+${comment.descendantCount + 1}]` : '[–]'}
                </button>
                {comment.author && <span class={isOp ? 'c-author c-op' : 'c-author'}>{comment.author}</span>}
                <span class="c-age">{timeAgo(comment.time)}</span>
                <a class="c-action" href={hnReplyUrl(comment.id, storyId)} target="_blank" rel="noopener noreferrer">
                    reply
                </a>
                <a class="c-action" href={hnItemUrl(comment.id)} target="_blank" rel="noopener noreferrer">
                    HN
                </a>
            </header>
            {!collapsed && <div class="c-body" dangerouslySetInnerHTML={body} />}
        </article>
    );
});
