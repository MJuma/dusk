import { createElement } from 'preact';
import type { FunctionComponent } from 'preact';

function shallowDiffers(a: object, b: object): boolean {
    const before = a as Record<string, unknown>;
    const after = b as Record<string, unknown>;
    for (const key in before) {
        if (before[key] !== after[key]) {
            return true;
        }
    }
    for (const key in after) {
        if (!(key in before)) {
            return true;
        }
    }
    return false;
}

/**
 * Skip re-rendering a function component while its props are shallowly equal, like React's
 * `memo`. Preact's core has no `memo`, and importing it from `preact/compat` would pull the whole
 * React compatibility layer (~1 KB gzipped) into the main bundle.
 */
export function memo<P extends object>(render: FunctionComponent<P>): FunctionComponent<P> {
    function shouldUpdate(this: { props: P }, next: P): boolean {
        return shallowDiffers(this.props, next);
    }
    // Preact calls function components with the component instance as `this`. The wrapped component
    // renders as a child, so the signals it reads still re-render it when the props haven't changed.
    function Memoed(this: { shouldComponentUpdate?: (next: P) => boolean }, props: P) {
        this.shouldComponentUpdate = shouldUpdate;
        return createElement(render, props);
    }
    Memoed.displayName = `Memo(${render.displayName ?? render.name})`;
    return Memoed as FunctionComponent<P>;
}
