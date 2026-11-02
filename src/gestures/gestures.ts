/**
 * Swipe gestures on touch screens, loaded on demand. One set of listeners on the document handles
 * every swipe:
 * - On a story or comment row, a horizontal swipe toward a side with actions slides the row and
 *   uncovers a strip naming the action it will run (Settings › Gestures).
 * - Otherwise, in the installed app, swiping right goes back and left goes forward (unless that
 *   side's row actions are turned on), since iOS gives home-screen apps no back gesture. Like iOS
 *   (and Apollo), the page follows the finger and uncovers a picture of the previous page, or
 *   the next page slides in over it.
 * - Also in the installed app (Safari has its own), pulling down at the top of a page refreshes it.
 */
import { COMMENT_ACTIONS, runAction, STORY_ACTIONS } from '../app/actions';
import { isInstalledApp } from '../app/device';
import { overlayOpen } from '../app/overlay';
import { splitActive } from '../app/layout';
import { loading, refresh } from '../app/refresh';
import { canGoBack, canGoForward, goBack, goForward, historyIndex, onLeavePage, route } from '../app/router';
import { settings } from '../app/settings';
import type { Settings } from '../app/settings';
import { stickyBottom } from '../thread/navigation';
import { commentRows, shownStories } from './rows';
import { levelOf, lockAxis, offsetFor, pickAction, sideOf, swipeConfig } from './swipe.logic';
import type { Level, Side, SwipeConfig } from './swipe.logic';

const NAMES: Record<string, string> = {
    'save': 'Save',
    'reply': 'Reply',
    'author': 'Author',
    'share': 'Share',
    'collapse': 'Collapse',
    'collapse-top': 'Collapse to Top',
};
/** In a browser tab, touches this close to an edge belong to the browser's own back/forward swipe. */
const EDGE_PX = 24;
/** In split view, a back/forward swipe this long navigates (the arrow indicator). */
const NAV_PX = 90;
/** Elsewhere the page slides: this share of the width, or a quick flick, completes the swipe. */
const NAV_SHARE = 0.35;
const FLICK_PX_PER_MS = 0.5;
const SETTLE_MS = 220;
/** Swipes never start on these: things that scroll sideways, form controls, the bars. */
const NO_SWIPE = 'pre, table, input, textarea, select, .topbar, .trail, .thread-nav, .toast, dialog, [data-no-swipe]';

interface Row {
    element: HTMLElement;
    slots: (side: Side) => readonly [string, string];
    run: (action: string) => void;
}

function slotsFor(current: Settings, kind: 'story' | 'comment', side: Side): readonly [string, string] {
    if (side === 'left') {
        if (current.disableLeftSwipes) {
            return ['none', 'none'];
        }
        return kind === 'story' ? [current.storySwipeLeftShort, current.storySwipeLeftLong] : [current.commentSwipeLeftShort, current.commentSwipeLeftLong];
    }
    if (current.disableRightSwipes) {
        return ['none', 'none'];
    }
    return kind === 'story' ? [current.storySwipeRightShort, current.storySwipeRightLong] : [current.commentSwipeRightShort, current.commentSwipeRightLong];
}

function rowAt(target: Element): Row | undefined {
    const current = settings.peek();
    const storyRow = target.closest<HTMLElement>('li.story[data-story]');
    const story = storyRow ? shownStories.get(Number(storyRow.dataset['story'])) : undefined;
    if (storyRow && story) {
        return {
            element: storyRow,
            slots: (side) => slotsFor(current, 'story', side),
            run: (action) => {
                const definition = STORY_ACTIONS[action as keyof typeof STORY_ACTIONS];
                if (definition) {
                    runAction(definition, { story });
                }
            },
        };
    }
    const commentRow = target.closest<HTMLElement>('.comments article.c');
    const comment = commentRow ? commentRows.target?.(Number(commentRow.id.slice(1))) : undefined;
    if (commentRow && comment) {
        return {
            element: commentRow,
            slots: (side) => slotsFor(current, 'comment', side),
            run: (action) => {
                const definition = COMMENT_ACTIONS[action as keyof typeof COMMENT_ACTIONS];
                if (!definition) {
                    return;
                }
                runAction(definition, comment);
                // Collapsing a comment whose top is scrolled away would leave its header off screen.
                if (action === 'collapse' && commentRow.getBoundingClientRect().top < stickyBottom()) {
                    comment.thread.jumpTo(comment.comment.id);
                }
            },
        };
    }
    return undefined;
}

function hasActions(row: Row, side: Side): boolean {
    return row.slots(side).some((action) => action !== 'none');
}

/** Back/forward by swiping, for the installed app: right goes back once left-side row actions are off. */
function navigates(side: Side): boolean {
    if (!isInstalledApp()) {
        return false;
    }
    const current = settings.peek();
    return side === 'left' ? current.disableLeftSwipes && (canGoBack.peek() || route.peek().name !== 'feed') : current.disableRightSwipes && canGoForward.peek();
}

// ── Row feedback ─────────────────────────────────────────────────────────────

function showRow(row: Row, dx: number, config: SwipeConfig, startY: number): string | undefined {
    const { element } = row;
    const side = sideOf(dx);
    const level: Level = levelOf(dx, config);
    const slots = row.slots(side);
    const action = pickAction(slots, level);
    const offset = hasActions(row, side) ? offsetFor(dx, config) : Math.round(dx * 0.15);
    // Before the swipe is far enough, name what it's heading for (dimmed).
    const upcoming = action ?? (slots[0] !== 'none' ? slots[0] : slots[1]);
    element.style.transition = 'none';
    element.style.transform = `translateX(${offset}px)`;
    element.style.setProperty('--swipe-dx', `${Math.abs(offset)}px`);
    element.style.setProperty('--swipe-y', `${startY}px`);
    element.classList.toggle('swipe-from-left', side === 'left');
    element.classList.toggle('swipe-from-right', side === 'right');
    element.classList.toggle('swipe-armed', action !== undefined);
    if (upcoming && upcoming !== 'none') {
        element.dataset['swipe'] = NAMES[upcoming] ?? upcoming;
        element.dataset['swipeAction'] = upcoming;
    } else {
        delete element.dataset['swipe'];
        delete element.dataset['swipeAction'];
    }
    return action;
}

function settleRow(element: HTMLElement): void {
    element.style.transition = 'transform 0.2s ease-out';
    element.style.transform = '';
    element.style.removeProperty('--swipe-dx');
    element.classList.remove('swipe-from-left', 'swipe-from-right', 'swipe-armed');
    delete element.dataset['swipe'];
    delete element.dataset['swipeAction'];
    element.addEventListener('transitionend', () => {
        element.style.transition = '';
    }, { once: true });
}

/** Where the label goes: mid-way down the row's on-screen part, wherever the finger is. */
function labelY(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const top = Math.max(rect.top, stickyBottom());
    const bottom = Math.min(rect.bottom, window.innerHeight);
    return Math.round((bottom > top ? (top + bottom) / 2 : rect.top + rect.height / 2) - rect.top);
}

// ── Back/forward: pictures of pages ──────────────────────────────────────────

interface Snapshot {
    page: HTMLElement;
    /** Copies of bars that were stuck to the top of the screen, placed where they were. */
    stuck: HTMLElement[];
}

/** Pictures of recently left pages, by history index, for the back/forward swipe to uncover. */
const snapshots = new Map<number, Snapshot>();
const KEEP_SNAPSHOTS = 4;
/** Rows this far beyond the screen are left out of a picture. */
const MARGIN_PX = 200;
const LISTS = '.stories, .comments';

/**
 * A copy of `source` with long lists cut down to the rows on screen (a spacer stands in for the
 * rows above), so capturing a 1,000-comment thread stays cheap.
 */
function trimmedCopy(source: Element): Node {
    if (source.matches(LISTS)) {
        const copy = source.cloneNode(false) as Element;
        const top = source.getBoundingClientRect().top;
        let started = false;
        for (const child of source.children) {
            const rect = child.getBoundingClientRect();
            if (rect.bottom < -MARGIN_PX) {
                continue;
            }
            if (rect.top > window.innerHeight + MARGIN_PX) {
                break;
            }
            if (!started) {
                started = true;
                const offset = rect.top - top - parseFloat(getComputedStyle(child).marginTop);
                if (offset > 0) {
                    const spacer = document.createElement('div');
                    spacer.style.height = `${offset}px`;
                    copy.append(spacer);
                }
            }
            copy.append(child.cloneNode(true));
        }
        return copy;
    }
    if (!source.querySelector(LISTS)) {
        return source.cloneNode(true);
    }
    const copy = source.cloneNode(false) as Element;
    for (const child of source.childNodes) {
        copy.append(child instanceof Element ? trimmedCopy(child) : child.cloneNode(true));
    }
    return copy;
}

function capture(): Snapshot | undefined {
    const page = document.querySelector<HTMLElement>('#app > .page');
    if (!page || splitActive.peek()) {
        return undefined;
    }
    const rect = page.getBoundingClientRect();
    // The page may be mid-slide (leaving by a swipe): place the picture where the page sits at rest.
    const shift = rect.left - page.offsetLeft;
    const copy = trimmedCopy(page) as HTMLElement;
    copy.style.removeProperty('transform');
    copy.style.removeProperty('transition');
    copy.classList.remove('page-swiping');
    copy.style.setProperty('--snapshot-top', `${rect.top}px`);
    copy.style.left = `${page.offsetLeft}px`;
    copy.style.width = `${page.offsetWidth}px`;
    copy.style.right = 'auto';
    // A sticky bar (the thread's "you are here" bar) only sticks while its page scrolls; place a copy where it was.
    const stuck: HTMLElement[] = [];
    for (const bar of page.querySelectorAll<HTMLElement>('.trail')) {
        const box = bar.getBoundingClientRect();
        if (box.bottom > 0 && box.top < window.innerHeight) {
            const clone = bar.cloneNode(true) as HTMLElement;
            clone.classList.add('nav-stuck');
            clone.style.top = `${box.top}px`;
            clone.style.left = `${box.left - shift}px`;
            clone.style.width = `${box.width}px`;
            stuck.push(clone);
        }
    }
    return { page: copy, stuck };
}

onLeavePage((index) => {
    if (!isInstalledApp()) {
        return;
    }
    const snapshot = capture();
    if (snapshot) {
        snapshots.set(index, snapshot);
    }
    for (const kept of snapshots.keys()) {
        if (Math.abs(kept - index) > KEEP_SNAPSHOTS) {
            snapshots.delete(kept);
        }
    }
});

// ── Back/forward: sliding the page ───────────────────────────────────────────

interface Slide {
    side: Side;
    page: HTMLElement;
    layer: HTMLElement;
    width: number;
}

function beginSlide(side: Side): Slide | undefined {
    const page = document.querySelector<HTMLElement>('#app > .page');
    if (!page) {
        return undefined;
    }
    const index = historyIndex();
    const snapshot = snapshots.get(side === 'left' ? index - 1 : index + 1);
    const layer = document.createElement('div');
    layer.className = side === 'left' ? 'nav-layer nav-layer-under' : 'nav-layer nav-layer-over';
    layer.setAttribute('aria-hidden', 'true');
    if (snapshot) {
        layer.append(snapshot.page, ...snapshot.stuck);
    }
    document.body.append(layer);
    page.classList.add('page-swiping');
    const slide = { side, page, layer, width: window.innerWidth };
    moveSlide(slide, 0, false);
    return slide;
}

/** `progress` is 0 (where the swipe started) to 1 (the other page fully in place). */
function moveSlide(slide: Slide, progress: number, animate: boolean): void {
    const { page, layer, width, side } = slide;
    const transition = animate ? `transform ${SETTLE_MS}ms ease-out` : 'none';
    page.style.transition = transition;
    layer.style.transition = animate ? `${transition}, --nav-dim ${SETTLE_MS}ms ease-out` : 'none';
    if (side === 'left') {
        // Back: this page slides right; the previous one comes in from slightly left, darkened.
        page.style.transform = `translateX(${Math.round(progress * width)}px)`;
        layer.style.transform = `translateX(${Math.round(-0.3 * width * (1 - progress))}px)`;
        layer.style.setProperty('--nav-dim', String(0.3 * (1 - progress)));
    } else {
        // Forward: the next page slides in from the right over this one.
        layer.style.transform = `translateX(${Math.round(width * (1 - progress))}px)`;
        page.style.transform = `translateX(${Math.round(-0.3 * width * progress)}px)`;
    }
}

function endSlide(slide: Slide): void {
    slide.page.style.transition = '';
    slide.page.style.transform = '';
    slide.page.classList.remove('page-swiping');
    slide.layer.remove();
}

/** Finish (navigate, then remove the picture once the real page is on screen) or spring back. */
function settleSlide(slide: Slide, complete: boolean): void {
    moveSlide(slide, complete ? 1 : 0, true);
    window.setTimeout(() => {
        if (!complete) {
            endSlide(slide);
            return;
        }
        const before = route.peek();
        if (slide.side === 'left') {
            goBack();
        } else {
            goForward();
        }
        const started = performance.now();
        const waitForPage = (): void => {
            if (route.peek() === before && performance.now() - started < 1200) {
                requestAnimationFrame(waitForPage);
                return;
            }
            // Two frames: one for the new page to render, one for its scroll position to be restored.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    endSlide(slide);
                });
            });
        };
        waitForPage();
    }, SETTLE_MS);
}

// ── Back/forward: the arrow (split view) ─────────────────────────────────────

let indicator: HTMLElement | undefined;

function showNav(side: Side, dx: number, y: number): boolean {
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'swipe-nav';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>';
        document.body.append(indicator);
    }
    const progress = Math.min(1, Math.abs(dx) / NAV_PX);
    indicator.classList.toggle('swipe-nav-forward', side === 'right');
    indicator.classList.toggle('swipe-nav-armed', progress >= 1);
    indicator.style.setProperty('--nav-progress', String(progress));
    indicator.style.setProperty('--nav-y', `${Math.round(y)}px`);
    indicator.classList.add('swipe-nav-shown');
    return progress >= 1;
}

function hideNav(): void {
    indicator?.classList.remove('swipe-nav-shown', 'swipe-nav-armed');
}

// ── Pull to refresh ──────────────────────────────────────────────────────────

/** Pulling this far (after resistance) refreshes when let go. */
const PULL_PX = 64;
const PULL_MAX_PX = 110;
/** While refreshing, the page rests this far down with the spinner above it. */
const PULL_REST_PX = 48;

let pullIndicator: HTMLElement | undefined;

/** Pulling down starts a refresh only from the very top of what's scrolling. */
function atTop(target: Element): boolean {
    const pane = target.closest<HTMLElement>('.split-list');
    return pane ? pane.scrollTop <= 0 : window.scrollY <= 0;
}

function showPull(offset: number, animate: boolean): void {
    const page = document.querySelector<HTMLElement>('#app > .page');
    if (!pullIndicator) {
        pullIndicator = document.createElement('div');
        pullIndicator.className = 'pull-indicator';
        pullIndicator.setAttribute('aria-hidden', 'true');
        pullIndicator.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6" /></svg>';
        document.body.append(pullIndicator);
    }
    const transition = animate ? `transform ${SETTLE_MS}ms ease-out` : 'none';
    if (page) {
        page.style.transition = transition;
        page.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
        page.classList.toggle('page-pulling', offset > 0);
    }
    pullIndicator.style.transition = animate ? `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms` : 'none';
    pullIndicator.style.setProperty('--pull', `${offset}px`);
    pullIndicator.style.setProperty('--pull-turn', `${Math.min(1, offset / PULL_PX) * 180}deg`);
    pullIndicator.classList.toggle('pull-armed', offset >= PULL_PX);
    pullIndicator.classList.toggle('pull-shown', offset > 0);
}

/** Refresh, keeping the spinner up until every reload it started has finished (at least briefly). */
function runRefresh(): void {
    pullIndicator?.classList.add('pull-refreshing');
    showPull(PULL_REST_PX, true);
    refresh();
    const started = performance.now();
    const wait = (): void => {
        const elapsed = performance.now() - started;
        // Give views a moment to start reloading, then wait for them (but never forever).
        if (elapsed < 500 || (loading.peek() > 0 && elapsed < 10_000)) {
            window.setTimeout(wait, 100);
            return;
        }
        pullIndicator?.classList.remove('pull-refreshing');
        showPull(0, true);
    };
    wait();
}

// ── Tracking ─────────────────────────────────────────────────────────────────

interface Gesture {
    x: number;
    y: number;
    config: SwipeConfig;
    row: Row | undefined;
    axis?: 'x' | 'y';
    mode?: 'row' | 'nav' | 'pull';
    /** Where the touch started, to tell which part of the page it pulls. */
    target: Element;
    pull: number;
    side?: Side;
    labelY: number;
    /** What letting go now would do. */
    action?: string;
    navArmed: boolean;
    /** The sliding page, for back/forward outside split view. */
    slide?: Slide;
    progress: number;
    /** Finger speed toward the navigating side, in px/ms. */
    speed: number;
    lastX: number;
    lastT: number;
}

let gesture: Gesture | undefined;

function swallow(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
}

/** A swipe shouldn't also count as a tap on whatever it started on. */
function swallowNextClick(): void {
    window.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => {
        window.removeEventListener('click', swallow, { capture: true });
    }, 400);
}

function end(run: boolean): void {
    const done = gesture;
    gesture = undefined;
    if (!done?.mode) {
        return;
    }
    swallowNextClick();
    if (done.mode === 'pull') {
        if (run && done.pull >= PULL_PX) {
            runRefresh();
        } else {
            showPull(0, true);
        }
    } else if (done.mode === 'row' && done.row) {
        settleRow(done.row.element);
        if (run && done.action) {
            done.row.run(done.action);
        }
    } else if (done.slide) {
        settleSlide(done.slide, run && (done.progress >= NAV_SHARE || (done.progress > 0.05 && done.speed > FLICK_PX_PER_MS)));
    } else {
        hideNav();
        if (run && done.navArmed) {
            if (done.side === 'left') {
                goBack();
            } else {
                goForward();
            }
        }
    }
}

document.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    const target = event.target instanceof Element ? event.target : null;
    gesture = undefined;
    if (event.touches.length !== 1 || !touch || !target || overlayOpen() || target.closest(NO_SWIPE)) {
        return;
    }
    if (!isInstalledApp() && (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX)) {
        return;
    }
    const row = rowAt(target);
    gesture = {
        x: touch.clientX,
        y: touch.clientY,
        config: swipeConfig(window.innerWidth),
        row,
        labelY: 0,
        navArmed: false,
        progress: 0,
        speed: 0,
        lastX: touch.clientX,
        lastT: event.timeStamp,
        target,
        pull: 0,
    };
}, { passive: true });

document.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!gesture || !touch) {
        return;
    }
    if (event.touches.length !== 1) {
        end(false);
        return;
    }
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (!gesture.axis) {
        gesture.axis = lockAxis(dx, dy, gesture.config);
        if (gesture.axis === undefined) {
            return;
        }
        if (gesture.axis === 'y') {
            // Pulling down from the top of the page refreshes it; any other vertical drag scrolls.
            if (dy > 0 && isInstalledApp() && atTop(gesture.target) && !pullIndicator?.classList.contains('pull-refreshing')) {
                gesture.mode = 'pull';
            } else {
                gesture = undefined;
                return;
            }
        }
        // Selecting text takes precedence over swiping.
        if (gesture.mode !== 'pull' && window.getSelection()?.isCollapsed === false) {
            gesture = undefined;
            return;
        }
        const side = sideOf(dx);
        if (gesture.mode === 'pull') {
            // Decided above.
        } else if (gesture.row && hasActions(gesture.row, side)) {
            gesture.mode = 'row';
            gesture.labelY = labelY(gesture.row.element);
        } else if (navigates(side)) {
            gesture.mode = 'nav';
            gesture.side = side;
            gesture.slide = splitActive.peek() ? undefined : beginSlide(side);
        } else if (gesture.row && (hasActions(gesture.row, 'left') || hasActions(gesture.row, 'right'))) {
            // The other side has actions: follow the finger a little, so reversing still works.
            gesture.mode = 'row';
            gesture.labelY = labelY(gesture.row.element);
        } else {
            gesture = undefined;
            return;
        }
    }
    // Once a swipe has started, it owns the touch: no scrolling at the same time.
    event.preventDefault();
    if (gesture.mode === 'pull') {
        // Follow the finger with growing resistance, up to a limit.
        gesture.pull = Math.round(Math.min(PULL_MAX_PX, Math.max(0, dy) * 0.55));
        showPull(gesture.pull, false);
    } else if (gesture.mode === 'row' && gesture.row) {
        gesture.action = showRow(gesture.row, dx, gesture.config, gesture.labelY);
    } else if (gesture.mode === 'nav' && gesture.side) {
        // Only movement toward the side that navigates counts.
        const toward = gesture.side === 'left' ? Math.max(0, dx) : Math.min(0, dx);
        const elapsed = Math.max(1, event.timeStamp - gesture.lastT);
        const step = (touch.clientX - gesture.lastX) * (gesture.side === 'left' ? 1 : -1);
        gesture.speed = 0.6 * (step / elapsed) + 0.4 * gesture.speed;
        gesture.lastX = touch.clientX;
        gesture.lastT = event.timeStamp;
        if (gesture.slide) {
            gesture.progress = Math.min(1, Math.abs(toward) / gesture.slide.width);
            moveSlide(gesture.slide, gesture.progress, false);
        } else {
            gesture.navArmed = showNav(gesture.side, toward, touch.clientY);
        }
    }
}, { passive: false });

document.addEventListener('touchend', () => {
    end(true);
}, { passive: true });

document.addEventListener('touchcancel', () => {
    end(false);
}, { passive: true });
