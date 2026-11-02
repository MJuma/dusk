// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { route } from './router';
import { setPageTitle, syncDocumentTitle } from './title';

describe('document title', () => {
    it('shows the story title on its thread, and drops it when leaving', () => {
        const stop = syncDocumentTitle();
        route.value = { name: 'item', id: 1 };
        expect(document.title).toBe('Dusk');
        setPageTitle('Show HN: A thing');
        expect(document.title).toBe('Show HN: A thing | Dusk');

        route.value = { name: 'feed', kind: 'new', page: 0 };
        expect(document.title).toBe('New | Dusk');
        route.value = { name: 'item', id: 2 };
        expect(document.title).toBe('Dusk');
        route.value = { name: 'user', id: 'pg', tab: 'comments' };
        expect(document.title).toBe("pg's comments | Dusk");
        stop();
    });
});
