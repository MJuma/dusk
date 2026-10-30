import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';

import { online } from '../app/online';
import { refreshTick } from '../app/refresh';
import { readHref, userHref } from '../app/router';
import { settingsOpen } from '../app/settings';
import { getVisit, markSeen, recordThreadLoad } from '../app/visits';
import type { Visit } from '../app/visits';
import { hnItemUrl } from '../data/hn';
import { source } from '../data/source';
import type { Thread } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';
import { ago, timeAgo } from '../lib/time';
import { savedItems, savedThread, saveSheet } from '../offline/saved';
import { CommentRow } from './CommentRow';
import { readingLine, rowAtLine, rowElement, scrollToRow, topbarBottom } from './navigation';
import type { Command } from './navigation';
import { pickTarget } from './navigation.logic';
import { maxCommentId, newCommentIds } from './newComments';
import { indexThread } from './threadIndex';
import { ThreadNav } from './ThreadNav';
import { expandAncestors, visibleRows } from './ThreadView.logic';

/** Rows rendered in the first frame; the rest follow right after so big threads paint quickly. */
const FIRST_PAINT_ROWS = 80;
/** A new comment counts as seen once it has been on screen this long. */
const SEEN_DWELL_MS = 400;
const SEEN_FLUSH_MS = 600;

const KEYS: Record<string, Command> = {
    j: 'next-comment',
    k: 'prev-comment',
    n: 'next-thread',
    p: 'prev-thread',
    N: 'next-new',
    P: 'prev-new',
    u: 'parent',
    r: 'root',
    c: 'toggle',
};

function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}


interface ThreadViewProps {
    id: number;
    /** A comment to jump to once the thread has loaded (e.g. from a profile's comment list). */
    focus?: number;
}

interface LoadedThread {
    thread: Thread | undefined;
    previous: Visit | undefined;
}

export function ThreadView({ id, focus }: ThreadViewProps) {
    const tick = refreshTick.value;
    // A thread together with the visit it's compared against: "new" means new since that visit.
    const [loaded, setLoaded] = useState<LoadedThread>(() => ({ thread: source.cachedThread(id), previous: getVisit(id) }));
    const { thread, previous } = loaded;
    const [error, setError] = useState<string>();
    const [toggled, setToggled] = useState<ReadonlySet<number>>(() => new Set());
    // A thread already in memory (e.g. coming back to it) renders in full at once, so the
    // reading position can be restored; a fresh load paints the first screen first.
    const [rowLimit, setRowLimit] = useState(() => (source.cachedThread(id) ? Number.POSITIVE_INFINITY : FIRST_PAINT_ROWS));
    const [focusId, setFocusId] = useState<number>();
    const [jump, setJump] = useState<{ id: number }>();
    const [currentThread, setCurrentThread] = useState(0);
    const loadsRef = useRef(0);
    const seenThisViewRef = useRef(new Set<number>());
    /** When the thread shown is the copy saved for offline reading, when that copy was saved. */
    const [savedCopyAt, setSavedCopyAt] = useState<number>();

    useEffect(() => {
        // The first load compares against the visit read at mount; a refresh against the latest one.
        const refreshed = loadsRef.current > 0 ? { visit: getVisit(id) } : undefined;
        loadsRef.current += 1;
        let active = true;
        let fresh = false;
        const accept = (next: Thread): void => {
            if (active) {
                fresh = true;
                setSavedCopyAt(undefined);
                setLoaded((current) => ({ thread: next, previous: refreshed ? refreshed.visit : current.previous }));
            }
        };
        // A copy saved for offline reading shows right away (and is all there is without a
        // connection); the network version replaces it when it arrives.
        if (!source.cachedThread(id)) {
            savedThread(id)
                .then((copy) => {
                    if (copy && active && !fresh) {
                        setSavedCopyAt(copy.savedAt);
                        setLoaded((current) => (current.thread ? current : { ...current, thread: copy.thread }));
                    }
                })
                .catch(() => undefined);
        }
        setError(undefined);
        performance.mark('dusk:thread-start');
        source.thread(id, accept)
            .then(accept)
            .catch((reason: unknown) => {
                if (active) {
                    setError(String(reason));
                }
            });
        return () => {
            active = false;
        };
    }, [id, tick]);

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

    const newIds = useMemo(() => newCommentIds(thread?.comments ?? [], previous), [thread, previous]);
    const index = useMemo(() => indexThread(thread?.comments ?? []), [thread]);
    const rows = useMemo(() => visibleRows(thread?.comments ?? [], toggled, newIds), [thread, toggled, newIds]);
    const rendered = useMemo(() => (rowLimit >= rows.length ? rows : rows.slice(0, rowLimit)), [rows, rowLimit]);
    const renderedIds = useMemo(() => rendered.map((row) => row.comment.id), [rendered]);
    const storyBody = useMemo(() => (thread?.story.text ? { __html: sanitizeHnHtml(thread.story.text) } : undefined), [thread]);

    // Latest render state for event handlers and observers, which stay stable across renders.
    const latestRef = useRef({ thread, index, rendered, renderedIds, newIds });
    useLayoutEffect(() => {
        latestRef.current = { thread, index, rendered, renderedIds, newIds };
    });

    // Remember this load so the next one can tell what's new.
    useEffect(() => {
        if (thread?.complete) {
            recordThreadLoad(id, {
                count: thread.story.descendants,
                maxId: maxCommentId(thread.comments),
                unseen: [...newIds].filter((commentId) => !seenThisViewRef.current.has(commentId)),
            });
        }
    }, [id, thread, newIds]);

    const toggle = useCallback((commentId: number) => {
        setToggled((previous) => {
            const next = new Set(previous);
            if (!next.delete(commentId)) {
                next.add(commentId);
            }
            return next;
        });
    }, []);

    const jumpTo = useCallback((commentId: number) => {
        const { thread: current, index: currentIndex } = latestRef.current;
        if (!current) {
            return;
        }
        setToggled((previous) => expandAncestors(current.comments, currentIndex.position, commentId, previous));
        setRowLimit(Number.POSITIVE_INFINITY);
        setJump({ id: commentId });
    }, []);

    useLayoutEffect(() => {
        if (jump) {
            scrollToRow(jump.id);
            setFocusId(jump.id);
            setJump(undefined);
        }
    }, [jump]);

    const navigate = useCallback((command: Command) => {
        const { thread: current, index: currentIndex, renderedIds: ids, newIds: fresh } = latestRef.current;
        if (!current || ids.length === 0) {
            return;
        }
        const line = readingLine();
        const row = rowAtLine(ids, line);
        const atId = ids[row];
        const position = atId === undefined ? -1 : (currentIndex.position.get(atId) ?? -1);
        const startsAbove = atId !== undefined && (rowElement(atId)?.getBoundingClientRect().top ?? line) < line - 2;
        const atComment = current.comments[position];
        const direction = command.startsWith('prev') ? -1 : 1;
        let target: number | undefined;
        switch (command) {
            case 'next-thread':
            case 'prev-thread':
                target = pickTarget(currentIndex.topLevel, position, startsAbove, direction);
                break;
            case 'next-comment':
            case 'prev-comment':
                target = pickTarget(ids.map((rowId) => currentIndex.position.get(rowId) ?? -1), position, startsAbove, direction);
                break;
            case 'next-new':
            case 'prev-new': {
                const positions = [...fresh].map((newId) => currentIndex.position.get(newId) ?? -1).sort((a, b) => a - b);
                // Wrap around so the button keeps cycling through new comments.
                target = pickTarget(positions, position, startsAbove, direction) ?? (direction === 1 ? positions[0] : positions.at(-1));
                break;
            }
            case 'parent':
                target = atComment && atComment.depth > 0 ? currentIndex.position.get(atComment.parentId) : undefined;
                break;
            case 'root':
                target = atComment ? currentIndex.topLevel[atComment.topLevelIndex] : undefined;
                break;
            case 'toggle':
                if (atComment) {
                    toggle(atComment.id);
                    target = position;
                }
                break;
        }
        const targetComment = target === undefined ? undefined : current.comments[target];
        if (targetComment) {
            jumpTo(targetComment.id);
        }
    }, [jumpTo, toggle]);

    // Jump to the linked comment once its final position is known.
    const focusedRef = useRef(false);
    useEffect(() => {
        if (focus !== undefined && !focusedRef.current && thread?.complete && index.position.has(focus)) {
            focusedRef.current = true;
            jumpTo(focus);
        }
    }, [focus, thread, index, jumpTo]);

    const openSave = useCallback(() => {
        if (thread) {
            saveSheet.value = thread.story;
        }
    }, [thread]);

    const nextNew = useCallback(() => {
        navigate('next-new');
    }, [navigate]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || settingsOpen.value || isTyping(event.target)) {
                return;
            }
            const command = KEYS[event.key];
            if (command) {
                event.preventDefault();
                navigate(command);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
        };
    }, [navigate]);

    // Track which top-level comment is at the reading line for the position indicator.
    useEffect(() => {
        let frame = 0;
        const update = (): void => {
            frame = 0;
            const { rendered: currentRows, renderedIds: ids } = latestRef.current;
            const row = currentRows[rowAtLine(ids, readingLine())];
            setCurrentThread(row ? row.comment.topLevelIndex + 1 : 0);
        };
        const onScroll = (): void => {
            if (frame === 0) {
                frame = requestAnimationFrame(update);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        update();
        return () => {
            window.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(frame);
        };
    }, [rendered]);

    // New comments stop being new once they've been on screen for a moment.
    useEffect(() => {
        if (newIds.size === 0 || typeof IntersectionObserver === 'undefined') {
            return undefined;
        }
        const navTop = document.querySelector('.thread-nav')?.getBoundingClientRect().top ?? window.innerHeight;
        const timers = new Map<Element, number>();
        const pending: number[] = [];
        let flushTimer = 0;
        const flush = (): void => {
            clearTimeout(flushTimer);
            flushTimer = 0;
            if (pending.length > 0) {
                markSeen(id, pending.splice(0));
            }
        };
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const viewport = entry.rootBounds?.height ?? window.innerHeight;
                const visible = entry.isIntersecting && (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= viewport * 0.4);
                const timer = timers.get(entry.target);
                if (visible && timer === undefined) {
                    timers.set(entry.target, window.setTimeout(() => {
                        const commentId = Number(entry.target.id.slice(1));
                        timers.delete(entry.target);
                        observer.unobserve(entry.target);
                        seenThisViewRef.current.add(commentId);
                        pending.push(commentId);
                        flushTimer ||= window.setTimeout(flush, SEEN_FLUSH_MS);
                    }, SEEN_DWELL_MS));
                } else if (!visible && timer !== undefined) {
                    clearTimeout(timer);
                    timers.delete(entry.target);
                }
            }
        }, {
            rootMargin: `${-Math.round(topbarBottom())}px 0px ${-Math.round(Math.max(0, window.innerHeight - navTop))}px 0px`,
            threshold: [0, 0.25, 0.5, 0.75, 1],
        });
        for (const commentId of newIds) {
            const element = seenThisViewRef.current.has(commentId) ? null : rowElement(commentId);
            if (element) {
                observer.observe(element);
            }
        }
        window.addEventListener('pagehide', flush);
        return () => {
            observer.disconnect();
            for (const timer of timers.values()) {
                clearTimeout(timer);
            }
            window.removeEventListener('pagehide', flush);
            flush();
        };
    }, [id, newIds, rendered]);

    if (!thread) {
        if (error && !online.value) {
            return <main class="status">You're offline and this thread isn't saved for offline reading.</main>;
        }
        return <main class="status">{error ?? 'Loading…'}</main>;
    }
    const { story } = thread;
    const lastLoad = previous?.commentsAt;
    const saved = savedItems.value.get(story.id);
    let status = error ? `Couldn't refresh: ${error}` : undefined;
    if (savedCopyAt !== undefined) {
        status = error || !online.value ? `Offline · showing the copy saved ${ago(savedCopyAt)}` : `Showing the copy saved ${ago(savedCopyAt)} · updating…`;
    }
    return (
        <main class="thread">
            <header class="thread-head">
                <h1 class="thread-title">
                    {story.url && !(saved?.article && !online.value) && (
                        <a href={story.url} target="_blank" rel="noopener noreferrer">
                            {story.title}
                        </a>
                    )}
                    {story.url && saved?.article && !online.value && <a href={readHref(story.id)}>{story.title}</a>}
                    {!story.url && story.title}
                </h1>
                <div class="story-meta">
                    {story.domain && <span class="story-domain">{story.domain}</span>}
                    {story.score} pts ·{' '}
                    <a class="story-by" href={userHref(story.by)}>
                        {story.by}
                    </a>
                    {' '}· {timeAgo(story.time)} · {story.descendants} comments ·{' '}
                    <a href={hnItemUrl(story.id)} target="_blank" rel="noopener noreferrer">
                        Open on HN
                    </a>
                    {' · '}
                    <button type="button" class={saved ? 'save-btn save-btn-saved' : 'save-btn'} onClick={openSave}>
                        {saved ? 'saved' : 'save for offline'}
                    </button>
                    {saved?.article && (
                        <>
                            {' · '}
                            <a href={readHref(story.id)}>read saved article</a>
                        </>
                    )}
                </div>
                {lastLoad !== undefined && (
                    <p class="thread-new">
                        {newIds.size > 0
                            ? (
                                <button type="button" class="link-btn" onClick={nextNew}>
                                    {newIds.size} new {newIds.size === 1 ? 'comment' : 'comments'}
                                </button>
                            )
                            : 'No new comments'}
                        {` since your last visit ${ago(lastLoad)}`}
                    </p>
                )}
                {storyBody && <div class="thread-text" dangerouslySetInnerHTML={storyBody} />}
            </header>
            {status && <p class="status">{status}</p>}
            <section class="comments" aria-label="Comments">
                {rendered.map(({ comment, collapsed, newInside }) => (
                    <CommentRow
                        key={comment.id}
                        comment={comment}
                        storyId={story.id}
                        isOp={comment.author === story.by}
                        collapsed={collapsed}
                        newInside={newInside}
                        isNew={newIds.has(comment.id)}
                        focused={comment.id === focusId}
                        links={index.links.get(comment.id)}
                        onToggle={toggle}
                        onJump={jumpTo}
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
            <ThreadNav current={currentThread} total={index.topLevel.length} newCount={newIds.size} onCommand={navigate} />
        </main>
    );
}
