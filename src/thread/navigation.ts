export type Command =
    | 'skim'
    | 'next-thread'
    | 'prev-thread'
    | 'next-comment'
    | 'prev-comment'
    | 'next-new'
    | 'prev-new'
    | 'parent'
    | 'root'
    | 'toggle';

/** Jump targets land this far below the top bar. */
const LANDING_GAP = 8;

export function topbarBottom(): number {
    return document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
}

/** Height of the sticky "you are here" bar under the top bar (it is always present in a thread). */
function trailHeight(): number {
    return document.querySelector<HTMLElement>('.trail')?.offsetHeight ?? 0;
}

/** Bottom of everything stuck to the top of the screen while reading a thread. */
export function stickyBottom(): number {
    return topbarBottom() + trailHeight();
}

/** The line just under the sticky bars that navigation treats as "where I am". */
export function readingLine(): number {
    return stickyBottom() + LANDING_GAP;
}

export function rowElement(id: number): HTMLElement | null {
    return document.getElementById(`c${id}`);
}

/** Index into `ids` (rendered rows, in order) of the row at `line`, or -1 when above the first row. */
export function rowAtLine(ids: readonly number[], line: number): number {
    let low = 0;
    let high = ids.length - 1;
    let found = -1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        const top = rowElement(ids[middle] as number)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
        if (top <= line + 2) {
            found = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return found;
}

export function scrollToRow(id: number): void {
    const element = rowElement(id);
    if (element) {
        window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - readingLine(), behavior: 'auto' });
    }
}
