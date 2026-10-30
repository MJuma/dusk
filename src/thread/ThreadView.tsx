import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks';

import { hnItemUrl } from '../data/hn';
import { source } from '../data/source';
import type { Thread } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';
import { timeAgo } from '../lib/time';
import { CommentRow } from './CommentRow';
import { visibleRows } from './ThreadView.logic';

/** Rows rendered in the first frame; the rest follow right after so big threads paint quickly. */
const FIRST_PAINT_ROWS = 80;

interface ThreadViewProps {
    id: number;
}

export function ThreadView({ id }: ThreadViewProps) {
    const [thread, setThread] = useState<Thread | undefined>(() => source.cachedThread(id));
    const [error, setError] = useState<string>();
    const [toggled, setToggled] = useState<ReadonlySet<number>>(() => new Set());
    const [rowLimit, setRowLimit] = useState(FIRST_PAINT_ROWS);

    useEffect(() => {
        const controller = new AbortController();
        performance.mark('dusk:thread-start');
        source.thread(id, { signal: controller.signal, onPartial: setThread })
            .then(setThread)
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setError(String(reason));
                }
            });
        return () => {
            controller.abort();
        };
    }, [id]);

    const hasComments = (thread?.comments.length ?? 0) > 0;
    useLayoutEffect(() => {
        if (!hasComments) {
            return undefined;
        }
        performance.mark('dusk:thread-first-render');
        const timer = setTimeout(() => {
            setRowLimit(Number.POSITIVE_INFINITY);
        }, 0);
        return () => {
            clearTimeout(timer);
        };
    }, [hasComments]);

    useLayoutEffect(() => {
        if (thread?.complete && rowLimit === Number.POSITIVE_INFINITY) {
            performance.mark('dusk:thread-complete-render');
        }
    }, [thread, rowLimit]);

    const toggle = useCallback((commentId: number) => {
        setToggled((previous) => {
            const next = new Set(previous);
            if (!next.delete(commentId)) {
                next.add(commentId);
            }
            return next;
        });
    }, []);

    const rows = useMemo(() => visibleRows(thread?.comments ?? [], toggled), [thread, toggled]);
    const storyBody = useMemo(() => (thread?.story.text ? { __html: sanitizeHnHtml(thread.story.text) } : undefined), [thread]);

    if (!thread) {
        return <main class="status">{error ?? 'Loading…'}</main>;
    }
    const { story } = thread;
    return (
        <main class="thread">
            <header class="thread-head">
                <h1 class="thread-title">
                    {story.url
                        ? <a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}</a>
                        : story.title}
                </h1>
                <div class="story-meta">
                    {story.domain && <span class="story-domain">{story.domain}</span>}
                    {story.score} pts · {story.by} · {timeAgo(story.time)} · {story.descendants} comments ·{' '}
                    <a href={hnItemUrl(story.id)} target="_blank" rel="noopener noreferrer">
                        Open on HN
                    </a>
                </div>
                {storyBody && <div class="thread-text" dangerouslySetInnerHTML={storyBody} />}
            </header>
            <section class="comments" aria-label="Comments">
                {rows.slice(0, rowLimit).map(({ comment, collapsed: isCollapsed }) => (
                    <CommentRow
                        key={comment.id}
                        comment={comment}
                        storyId={story.id}
                        isOp={comment.author === story.by}
                        collapsed={isCollapsed}
                        onToggle={toggle}
                    />
                ))}
            </section>
            {!thread.complete && <p class="status">Ordering replies…</p>}
            {thread.complete && thread.unavailable > 0 && (
                <p class="status">
                    {thread.unavailable} {thread.unavailable === 1 ? 'comment is' : 'comments are'} only available on HN.{' '}
                    <a href={hnItemUrl(story.id)} target="_blank" rel="noopener noreferrer">
                        Open on HN
                    </a>
                </p>
            )}
        </main>
    );
}
