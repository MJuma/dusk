/**
 * The arithmetic of a horizontal swipe, kept apart from the DOM so it can be tested. Distances
 * are in CSS pixels; `dx` is how far the finger has moved (positive = to the right).
 */
export interface SwipeConfig {
    /** Movement before deciding between a swipe and a scroll. */
    lockPx: number;
    /** A drag counts as horizontal when its horizontal part exceeds the vertical by this factor. */
    ratio: number;
    /** A swipe this long runs the short action… */
    shortPx: number;
    /** …and this long the long action. */
    longPx: number;
}

export type Side = 'left' | 'right';
export type Level = 0 | 1 | 2;

export function swipeConfig(width: number): SwipeConfig {
    return { lockPx: 10, ratio: 1.2, shortPx: 64, longPx: Math.max(150, Math.round(width * 0.42)) };
}

/** Undecided until the finger has moved far enough; then horizontal (a swipe) or vertical (a scroll). */
export function lockAxis(dx: number, dy: number, config: SwipeConfig): 'x' | 'y' | undefined {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < config.lockPx) {
        return undefined;
    }
    return Math.abs(dx) > Math.abs(dy) * config.ratio ? 'x' : 'y';
}

/** Moving the finger right uncovers a row's left side, so it runs the "left" swipe actions. */
export function sideOf(dx: number): Side {
    return dx > 0 ? 'left' : 'right';
}

export function levelOf(dx: number, config: SwipeConfig): Level {
    const distance = Math.abs(dx);
    if (distance >= config.longPx) {
        return 2;
    }
    return distance >= config.shortPx ? 1 : 0;
}

/**
 * The action a swipe would run, given that side's [short, long] actions ("none" for unset). A
 * long swipe runs the short action when there's no long one.
 */
export function pickAction(slots: readonly [string, string], level: Level): string | undefined {
    const [short, long] = slots;
    if (level === 2 && long !== 'none') {
        return long;
    }
    return level >= 1 && short !== 'none' ? short : undefined;
}

/** How far the row moves: with the finger, then with growing resistance past the long threshold. */
export function offsetFor(dx: number, config: SwipeConfig): number {
    const distance = Math.abs(dx);
    const moved = distance <= config.longPx ? distance : config.longPx + (distance - config.longPx) * 0.35;
    return Math.sign(dx) * Math.round(moved);
}
