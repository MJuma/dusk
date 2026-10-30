import { signal } from '@preact/signals';

/** What Dusk remembers about a story on this device. Times are epoch milliseconds. */
export interface Visit {
    /** When the story's link was last opened. */
    linkAt?: number;
    /** When the comments were last loaded. */
    commentsAt?: number;
    /** HN's comment count at the last load. */
    count?: number;
    /** Highest comment id at the last load. HN ids only grow, so anything above it is new. */
    maxId?: number;
    /** New comments that haven't been scrolled into view yet; they stay new on the next load. */
    unseen?: number[];
}

// One key per story so tabs (comments can open in new tabs) never overwrite each other's updates.
const PREFIX = 'dusk:visit:';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function parseVisit(raw: string | null): Visit | undefined {
    if (!raw) {
        return undefined;
    }
    try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        const visit: Visit = {};
        for (const key of ['linkAt', 'commentsAt', 'count', 'maxId'] as const) {
            const value = data[key];
            if (isNumber(value)) {
                visit[key] = value;
            }
        }
        const unseen = data['unseen'];
        if (Array.isArray(unseen)) {
            visit.unseen = unseen.filter(isNumber);
        }
        return visit;
    } catch {
        return undefined;
    }
}

function lastActivity(visit: Visit): number {
    return Math.max(visit.linkAt ?? 0, visit.commentsAt ?? 0);
}

function loadAll(): Map<number, Visit> {
    const all = new Map<number, Visit>();
    try {
        const now = Date.now();
        const stale: string[] = [];
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key?.startsWith(PREFIX)) {
                continue;
            }
            const visit = parseVisit(localStorage.getItem(key));
            if (!visit || now - lastActivity(visit) > MAX_AGE_MS) {
                stale.push(key);
            } else {
                all.set(Number(key.slice(PREFIX.length)), visit);
            }
        }
        for (const key of stale) {
            localStorage.removeItem(key);
        }
    } catch {
        // Storage disabled: remember visits for this session only.
    }
    return all;
}

export const visits = signal<ReadonlyMap<number, Visit>>(loadAll());

function write(id: number, visit: Visit): void {
    const next = new Map(visits.value);
    next.set(id, visit);
    visits.value = next;
    try {
        localStorage.setItem(`${PREFIX}${id}`, JSON.stringify(visit));
    } catch {
        // Storage full or disabled: keep the in-memory copy.
    }
}

export function getVisit(id: number): Visit | undefined {
    return visits.value.get(id);
}

export function recordLinkOpen(id: number): void {
    write(id, { ...visits.value.get(id), linkAt: Date.now() });
}

export function recordThreadLoad(id: number, load: { count: number; maxId: number; unseen: number[] }): void {
    const previous = visits.value.get(id);
    write(id, {
        ...previous,
        commentsAt: Date.now(),
        count: load.count,
        maxId: Math.max(load.maxId, previous?.maxId ?? 0),
        unseen: load.unseen,
    });
}

export function markSeen(id: number, commentIds: readonly number[]): void {
    const previous = visits.value.get(id);
    if (!previous?.unseen?.length) {
        return;
    }
    const seen = new Set(commentIds);
    const unseen = previous.unseen.filter((commentId) => !seen.has(commentId));
    if (unseen.length !== previous.unseen.length) {
        write(id, { ...previous, unseen });
    }
}

// Keep the story list current when another tab (e.g. comments opened in a new tab) records a visit.
window.addEventListener('storage', (event) => {
    if (event.key === null) {
        visits.value = loadAll();
        return;
    }
    if (!event.key.startsWith(PREFIX)) {
        return;
    }
    const next = new Map(visits.value);
    const id = Number(event.key.slice(PREFIX.length));
    const visit = parseVisit(event.newValue);
    if (visit) {
        next.set(id, visit);
    } else {
        next.delete(id);
    }
    visits.value = next;
});
