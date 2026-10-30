// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { itemHref, parseHash, routeKey, userHref } from './router';

describe('router', () => {
    it('parses user profiles and their comment tab', () => {
        expect(parseHash('#/user/pg')).toEqual({ name: 'user', id: 'pg', tab: 'submissions' });
        expect(parseHash('#/user/some_one-2/comments')).toEqual({ name: 'user', id: 'some_one-2', tab: 'comments' });
    });

    it('parses a thread link that focuses one comment', () => {
        expect(parseHash('#/item/123/456')).toEqual({ name: 'item', id: 123, focus: 456 });
        expect(parseHash('#/item/123')).toEqual({ name: 'item', id: 123 });
    });

    it('builds links that round-trip', () => {
        expect(parseHash(userHref('a b', 'comments'))).toEqual({ name: 'user', id: 'a b', tab: 'comments' });
        expect(parseHash(itemHref(1, 2))).toEqual({ name: 'item', id: 1, focus: 2 });
    });

    it('keeps separate scroll positions per profile tab and focused comment', () => {
        expect(routeKey(parseHash('#/user/pg'))).not.toBe(routeKey(parseHash('#/user/pg/comments')));
        expect(routeKey(parseHash('#/item/1/2'))).not.toBe(routeKey(parseHash('#/item/1')));
    });
});
