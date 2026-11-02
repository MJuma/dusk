import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';

import { online } from '../app/online';
import { refreshTick } from '../app/refresh';
import { fromHref, itemHref, readHref, userHref } from '../app/router';
import { settingsOpen } from '../app/settings';
import { setPageTitle } from '../app/title';
import { getVisit, markSeen, recordThreadLoad } from '../app/visits';
import type { Visit } from '../app/visits';
import { hnItemUrl } from '../data/hn';
import { readThread } from '../data/cache';
import { source } from '../data/source';
import type { Thread, ThreadComment } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';
import { ago, timeAgo } from '../lib/time';
import { savedItems, savedThread, saveSheet } from '../offline/saved';
import { CommentRow } from './CommentRow';
import { readingLine, rowAtLine, rowElement, scrollToRow, stickyBottom } from './navigation';
import type { Command } from './navigation';
import { pickTarget } from './navigation.logic';
import { maxCommentId, newCommentIds } from './newComments';
import { indexThread } from './threadIndex';
import { Poll } from './Poll';
import { ThreadNav } from './ThreadNav';
import { expandAncestors, isCollapsed, visibleRows } from './ThreadView.logic';
import { Trail } from './Trail';

/** Rows rendered in the first frame; the rest follow right after so big threads paint quickly. */
const FIRST_PAINT_ROWS = 80;
/** A new comment counts as seen once it has been on screen this long. */
const SEEN_DWELL_MS = 400;
const SEEN_FLUSH_MS = 600;
/** A horizontal swipe this long on a comment collapses or expands it. */
const SWIPE_MIN_PX = 70;
/** Movement before deciding whether a touch is a swipe (horizontal) or a scroll (vertical). */
const SWIPE_LOCK_PX = 8;
/** Touches starting this close to the left edge belong to the system back gesture. */
const EDGE_PX = 24;

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
    s: 'skim',
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
    /** The comment at the reading line; undefined above the comments. */
    const [currentId, setCurrentId] = useState<number>();
    const loadsRef = useRef(0);
    const seenThisViewRef = useRef(new Set<number>());
    /** When the thread shown is a stored copy (saved for offline, or cached from last time), its age and kind. */
    const [copy, setCopy] = useState<{ at: number; saved: boolean }>();

    useEffect(() => {
        // The first load compares against the visit read at mount; a refresh against the latest one.
        const refreshed = loadsRef.current > 0 ? { visit: getVisit(id) } : undefined;
        loadsRef.current += 1;
        let active = true;
        let fresh = false;
        const accept = (next: Thread): void => {
            if (active) {
                fresh = true;
                setCopy(undefined);
                setLoaded((current) => ({ thread: next, previous: refreshed ? refreshed.visit : current.previous }));
            }
        };
        // A stored copy (saved for offline reading, or cached from last time; whichever is newer)
        // shows right away and is all there is without a connection. The network version replaces it.
        if (!source.cachedThread(id)) {
            Promise.all([savedThread(id), readThread(id).catch(() => undefined)])
                .then(([saved, cached]) => {
                    const useSaved = saved !== undefined && (cached === undefined || saved.savedAt >= cached.at);
                    const stored = useSaved ? { thread: saved.thread, at: saved.savedAt } : cached;
                    if (stored && active && !fresh) {
                        setCopy({ at: stored.at, saved: useSaved });
                        setLoaded((current) => (current.thread ? current : { ...current, thread: stored.thread }));
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
    const storyTitle = thread?.story.title;
    useEffect(() => {
        setPageTitle(storyTitle);
    }, [storyTitle]);

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
    const latestRef = useRef({ thread, index, rendered, renderedIds, newIds, toggled });
    useLayoutEffect(() => {
        latestRef.current = { thread, index, rendered, renderedIds, newIds, toggled };
    });

    // Remember this load so the next one can tell what's new.
    useEffect(() => {
        // A comment link resolves to its story: move to the story's address, scrolled to the comment.
        if (thread?.complete && thread.story.id !== id) {
            if (thread.focus !== undefined) {
                location.replace(itemHref(thread.story.id, thread.focus));
            }
            return;
        }
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
            case 'skim': {
                // Collapse every top-level thread (or restore HN's defaults), staying in the current one.
                const topLevel = currentIndex.topLevel.map((topPosition) => current.comments[topPosition]).filter((comment) => comment !== undefined);
                const skimmed = topLevel.every((comment) => isCollapsed(comment, latestRef.current.toggled));
                setToggled(skimmed ? new Set() : new Set(topLevel.filter((comment) => !comment.collapsedByDefault).map((comment) => comment.id)));
                target = atComment ? currentIndex.topLevel[atComment.topLevelIndex] : undefined;
                break;
            }
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

    const currentComment = currentId === undefined ? undefined : thread?.comments[index.position.get(currentId) ?? -1];
    const chain = useMemo(() => {
        const result = [];
        let comment = currentComment;
        while (comment && thread) {
            result.unshift(comment);
            comment = comment.depth > 0 ? thread.comments[index.position.get(comment.parentId) ?? -1] : undefined;
        }
        return result;
    }, [currentComment, thread, index]);
    const skimmed = useMemo(
        () => index.topLevel.length > 0 && index.topLevel.every((position) => {
            const comment = thread?.comments[position];
            return comment !== undefined && isCollapsed(comment, toggled);
        }),
        [index, thread, toggled],
    );
    const toggleSkim = useCallback(() => {
        navigate('skim');
    }, [navigate]);

    // Tap a rail to collapse (or expand) the comment at that level; swipe a comment either way to
    // collapse it (or expand it, if collapsed). Both are delegated from the comment list.
    const commentsRef = useRef<HTMLElement>(null);
    useEffect(() => {
        const section = commentsRef.current;
        if (!section) {
            return undefined;
        }
        const commentFor = (element: Element): ThreadComment | undefined => {
            const { thread: current, index: currentIndex } = latestRef.current;
            return current?.comments[currentIndex.position.get(Number(element.id.slice(1))) ?? -1];
        };
        const ancestorAt = (comment: ThreadComment, level: number): ThreadComment | undefined => {
            const { thread: current, index: currentIndex } = latestRef.current;
            let ancestor: ThreadComment | undefined = comment;
            while (ancestor && ancestor.depth > level) {
                ancestor = current?.comments[currentIndex.position.get(ancestor.parentId) ?? -1];
            }
            return ancestor;
        };

        /** The comment whose rail is nearest a press in a comment's rail area (its left padding). */
        const railTarget = (target: EventTarget | null, clientX: number): ThreadComment | undefined => {
            // Presses on a comment's text land on its children; only the rail area hits the article itself.
            const article = target instanceof HTMLElement && target.matches('article.c') ? target : undefined;
            const comment = article ? commentFor(article) : undefined;
            if (!article || !comment) {
                return undefined;
            }
            const style = getComputedStyle(article);
            const railsEnd = parseFloat(style.paddingLeft);
            const x = clientX - article.getBoundingClientRect().left;
            if (x >= railsEnd) {
                return undefined;
            }
            const indent = parseFloat(style.getPropertyValue('--indent'));
            const gutter = railsEnd - comment.depth * indent - parseFloat(style.getPropertyValue('--rail-gap'));
            return ancestorAt(comment, Math.max(0, Math.min(comment.depth, Math.round((x - gutter) / indent))));
        };
        // While a rail is pressed, highlight the comment it would collapse.
        let pressed: Element | null = null;
        const release = (): void => {
            pressed?.classList.remove('c-rail-target');
            pressed = null;
        };
        const onPointerDown = (event: PointerEvent): void => {
            release();
            const target = railTarget(event.target, event.clientX);
            pressed = target ? rowElement(target.id) : null;
            pressed?.classList.add('c-rail-target');
        };
        const onClick = (event: MouseEvent): void => {
            release();
            const target = railTarget(event.target, event.clientX);
            if (target) {
                toggle(target.id);
                jumpTo(target.id);
            }
        };

        interface Swipe {
            x: number;
            y: number;
            element: HTMLElement;
            comment: ThreadComment;
            axis?: 'x' | 'y';
            armed: boolean;
        }
        let swipe: Swipe | undefined;
        const settle = (element: HTMLElement): void => {
            element.style.transition = 'transform 0.2s ease-out';
            element.style.transform = '';
            element.style.removeProperty('--swipe-dx');
            element.classList.remove('c-swipe-left', 'c-swipe-right', 'c-swipe-armed');
            delete element.dataset['swipe'];
            element.addEventListener('transitionend', () => {
                element.style.transition = '';
            }, { once: true });
        };
        /** Start showing a swipe: label it, and place the label mid-way down the comment's on-screen part. */
        const beginSwipe = (current: Swipe): void => {
            const { element, comment } = current;
            element.dataset['swipe'] = isCollapsed(comment, latestRef.current.toggled) ? 'Expand' : 'Collapse';
            const rect = element.getBoundingClientRect();
            const top = Math.max(rect.top, stickyBottom());
            const bottom = Math.min(rect.bottom, window.innerHeight);
            const middle = bottom > top ? (top + bottom) / 2 : rect.top + rect.height / 2;
            element.style.setProperty('--swipe-y', `${Math.round(middle - rect.top)}px`);
        };
        const onTouchStart = (event: TouchEvent): void => {
            const touch = event.touches[0];
            const target = event.target instanceof Element ? event.target : undefined;
            const article = target?.closest<HTMLElement>('article.c');
            const comment = article ? commentFor(article) : undefined;
            swipe = event.touches.length === 1 && touch && article && comment && touch.clientX > EDGE_PX && !target?.closest('pre, table, a, button')
                ? { x: touch.clientX, y: touch.clientY, element: article, comment, armed: false }
                : undefined;
        };
        const onTouchMove = (event: TouchEvent): void => {
            const touch = event.touches[0];
            if (!swipe || !touch) {
                return;
            }
            const dx = touch.clientX - swipe.x;
            const dy = touch.clientY - swipe.y;
            if (!swipe.axis) {
                if (Math.abs(dx) < SWIPE_LOCK_PX && Math.abs(dy) < SWIPE_LOCK_PX) {
                    return;
                }
                // Mostly-horizontal drags are swipes; anything else is scrolling.
                swipe.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
                if (swipe.axis === 'y') {
                    return;
                }
                beginSwipe(swipe);
            }
            if (swipe.axis !== 'x') {
                return;
            }
            const { element } = swipe;
            swipe.armed = Math.abs(dx) >= SWIPE_MIN_PX;
            // Follow the finger, with resistance past the threshold.
            const distance = Math.abs(dx);
            const moved = Math.round(distance <= SWIPE_MIN_PX ? distance : SWIPE_MIN_PX + (distance - SWIPE_MIN_PX) * 0.6);
            element.style.transition = 'none';
            element.style.transform = `translateX(${Math.sign(dx) * moved}px)`;
            // The strip behind the label fills exactly the space the comment has moved out of.
            element.style.setProperty('--swipe-dx', `${moved}px`);
            element.classList.toggle('c-swipe-left', dx < 0);
            element.classList.toggle('c-swipe-right', dx > 0);
            element.classList.toggle('c-swipe-armed', swipe.armed);
        };
        const onTouchEnd = (): void => {
            const done = swipe;
            swipe = undefined;
            if (!done || done.axis !== 'x') {
                return;
            }
            settle(done.element);
            if (done.armed) {
                const { comment, element } = done;
                toggle(comment.id);
                // Collapsing a comment whose top is scrolled away would leave its header off screen.
                if (element.getBoundingClientRect().top < stickyBottom()) {
                    jumpTo(comment.id);
                } else {
                    setFocusId(comment.id);
                }
            }
        };
        const onTouchCancel = (): void => {
            if (swipe?.axis === 'x') {
                settle(swipe.element);
            }
            swipe = undefined;
        };
        section.addEventListener('pointerdown', onPointerDown);
        section.addEventListener('pointerup', release);
        section.addEventListener('pointercancel', release);
        section.addEventListener('click', onClick);
        section.addEventListener('touchstart', onTouchStart, { passive: true });
        section.addEventListener('touchmove', onTouchMove, { passive: true });
        section.addEventListener('touchend', onTouchEnd, { passive: true });
        section.addEventListener('touchcancel', onTouchCancel, { passive: true });
        return () => {
            section.removeEventListener('pointerdown', onPointerDown);
            section.removeEventListener('pointerup', release);
            section.removeEventListener('pointercancel', release);
            section.removeEventListener('click', onClick);
            section.removeEventListener('touchstart', onTouchStart);
            section.removeEventListener('touchmove', onTouchMove);
            section.removeEventListener('touchend', onTouchEnd);
            section.removeEventListener('touchcancel', onTouchCancel);
        };
    }, [toggle, jumpTo, thread]);

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
            setCurrentId(row?.comment.id);
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
            rootMargin: `${-Math.round(stickyBottom())}px 0px ${-Math.round(Math.max(0, window.innerHeight - navTop))}px 0px`,
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
    if (copy) {
        const which = copy.saved ? `the copy saved ${ago(copy.at)}` : `the copy from ${ago(copy.at)}`;
        if (error || !online.value) {
            status = `Offline · showing ${which}`;
        } else {
            status = copy.saved ? `Showing ${which} · updating…` : 'Updating…';
        }
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
                    {story.domain && (
                        <a class="story-domain" href={fromHref(story.domain)}>
                            {story.domain}
                        </a>
                    )}
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
                {thread.poll && <Poll options={thread.poll} />}
            </header>
            {status && <p class="status">{status}</p>}
            {index.topLevel.length > 0 && (
                <Trail chain={chain} topLevelCount={index.topLevel.length} skimmed={skimmed} onJump={jumpTo} onSkim={toggleSkim} />
            )}
            <section ref={commentsRef} class="comments" aria-label="Comments">
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
            <ThreadNav current={currentComment ? currentComment.topLevelIndex + 1 : 0} total={index.topLevel.length} newCount={newIds.size} onCommand={navigate} />
        </main>
    );
}
