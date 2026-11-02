/** What kind of device this is, for per-device defaults and features. */

export function isInstalledApp(): boolean {
    return matchMedia('(display-mode: standalone)').matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone, iPad or iPod. iPadOS reports itself as a Mac; touch support tells them apart. */
export function isIos(): boolean {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function isIpad(): boolean {
    return isIos() && !/iPhone|iPod/.test(navigator.userAgent);
}

/** A mouse or trackpad is the main pointer (a laptop or desktop). */
export function hasFinePointer(): boolean {
    return matchMedia('(pointer: fine)').matches;
}

/** A phone-sized touch screen (not a tablet or laptop). */
export function isPhone(): boolean {
    return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
}

/** Has a touch screen, so swipe gestures apply. */
export function hasTouch(): boolean {
    return navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches;
}
