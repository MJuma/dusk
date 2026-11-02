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

/** HN's month names: short for some, spelled out for others ("Sept", "April"). */
const HN_MONTHS = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'] as const;

function plural(count: number, unit: string): string {
    return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/**
 * An age worded like HN's: "47 minutes ago", "3 hours ago", "64 days ago", "6 months ago", and
 * "on Sept 10, 2025" past a year.
 */
export function hnAge(unixSeconds: number, nowMs: number = Date.now()): string {
    const minutes = Math.max(0, Math.floor((nowMs / 1000 - unixSeconds) / 60));
    if (minutes < 60) {
        return plural(minutes, 'minute');
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return plural(hours, 'hour');
    }
    const days = Math.floor(hours / 24);
    if (days < 90) {
        return plural(days, 'day');
    }
    if (days < 365) {
        return plural(Math.floor(days / 30), 'month');
    }
    const date = new Date(unixSeconds * 1000);
    return `on ${HN_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** The full date and time, in the reader's own format, e.g. "Oct 26, 2026, 2:59 PM". */
export function fullTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Machine-readable time for <time datetime>. */
export function isoTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toISOString();
}
