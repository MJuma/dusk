const UNITS: [number, string][] = [
    [365 * 24 * 3600, 'y'],
    [30 * 24 * 3600, 'mo'],
    [24 * 3600, 'd'],
    [3600, 'h'],
    [60, 'm'],
];

/** Compact relative age, e.g. "5m", "3h", "2d". */
export function timeAgo(unixSeconds: number, nowMs: number = Date.now()): string {
    const seconds = Math.max(0, Math.floor(nowMs / 1000) - unixSeconds);
    for (const [size, unit] of UNITS) {
        if (seconds >= size) {
            return `${Math.floor(seconds / size)}${unit}`;
        }
    }
    return 'now';
}

/** "just now" or "5m ago" for an epoch-millisecond timestamp. */
export function ago(epochMs: number, nowMs: number = Date.now()): string {
    const age = timeAgo(Math.floor(epochMs / 1000), nowMs);
    return age === 'now' ? 'just now' : `${age} ago`;
}
