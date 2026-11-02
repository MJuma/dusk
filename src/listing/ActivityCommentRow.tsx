import { memo } from '../lib/memo';
import { useMemo } from 'preact/hooks';

import { itemHref, userHref } from '../app/router';
import type { UserComment } from '../data/types';
import { nameHue } from '../lib/nameHue';
import { sanitizeHnHtml } from '../lib/sanitize';
import { fullTime, hnAge, isoTime } from '../lib/time';


interface ActivityCommentRowProps {
    comment: UserComment;
    showAuthor: boolean;
}

/** A comment out of its thread (profile, search, newest comments), linking to it in context. */
export const ActivityCommentRow = memo(function ActivityCommentRow({ comment, showAuthor }: ActivityCommentRowProps) {
    const body = useMemo(() => ({ __html: sanitizeHnHtml(comment.html) }), [comment.html]);
    const style = useMemo(() => ({ '--d': 0, '--name-h': nameHue(comment.author) }), [comment.author]);
    return (
        <article class="c c-top" style={style} data-hue="0">
            <header class="c-head">
                {showAuthor && (
                    <a class="c-author" href={userHref(comment.author)}>
                        {comment.author}
                    </a>
                )}
                <a class="c-age" href={itemHref(comment.storyId, comment.id)} title={fullTime(comment.time)}>
                    <time dateTime={isoTime(comment.time)}>{hnAge(comment.time)}</time>
                </a>
                <span>
                    on:{' '}
                    <a class="c-story" href={itemHref(comment.storyId, comment.id)}>
                        {comment.storyTitle || 'thread'}
                    </a>
                </span>
            </header>
            <div class="c-body" dangerouslySetInnerHTML={body} />
        </article>
    );
});
