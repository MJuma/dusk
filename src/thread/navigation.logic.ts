/**
 * Picks the next (direction 1) or previous (direction -1) target from `candidates`, sorted thread
 * positions, relative to the comment at the reading line. Going back from partway through a
 * comment returns to the start of that comment first.
 */
export function pickTarget(
    candidates: readonly number[],
    current: number,
    currentStartsAbove: boolean,
    direction: 1 | -1,
): number | undefined {
    if (direction === 1) {
        return candidates.find((position) => position > current);
    }
    for (let index = candidates.length - 1; index >= 0; index--) {
        const position = candidates[index] as number;
        if (position < current || (position === current && currentStartsAbove)) {
            return position;
        }
    }
    return undefined;
}
