import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/**
 * A component whose code loads the first time it renders. Used for secondary pages and dialogs
 * so the feed and threads stay small; the service worker precaches every chunk, so this works
 * offline too.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>, fallback: preact.ComponentChild = null) {
    let loaded: ComponentType<P> | undefined;
    let pending: Promise<ComponentType<P>> | undefined;
    return function LazyComponent(props: P) {
        const [component, setComponent] = useState<{ value?: ComponentType<P> }>(() => ({ value: loaded }));
        useEffect(() => {
            if (component.value) {
                return undefined;
            }
            let active = true;
            pending ??= load().then((value) => {
                loaded = value;
                return value;
            });
            pending
                .then((value) => {
                    if (active) {
                        setComponent({ value });
                    }
                })
                .catch(() => {
                    pending = undefined;
                });
            return () => {
                active = false;
            };
        }, [component]);
        const Component = component.value;
        return Component ? <Component {...props} /> : <>{fallback}</>;
    };
}
