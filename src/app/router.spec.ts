// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { fromHref, itemHref, parseHash, routeKey, searchHref, shiftDay, today, userHref } from './router';

describe('router', () => {
    it('parses user profiles and their comment tab', () => {
        expect(parseHash('#/user/pg')).toEqual({ name: 'user', id: 'pg', tab: 'submissions' });
        expect(parseHash('#/user/some_one-2/comments')).toEqual({ name: 'user', id: 'some_one-2', tab: 'comments' });
    });

    it('parses a thread link that focuses one comment', () => {
        expect(parseHash('#/item/123/456')).toEqual({ name: 'item', id: 123, focus: 456 });
        expect(parseHash('#/item/123')).toEqual({ name: 'item', id: 123 });
    });

    it('parses the saved list and the reader view', () => {
        expect(parseHash('#/saved')).toEqual({ name: 'saved' });
        expect(parseHash('#/read/42')).toEqual({ name: 'read', id: 42 });
        expect(parseHash('#/read/x')).toEqual({ name: 'feed', kind: 'top', page: 0 });
    });

    it('parses search, past, newest comments and from-site', () => {
        expect(parseHash(searchHref('rust lang', 'comments', 'recent'))).toEqual({ name: 'search', query: 'rust lang', type: 'comments', sort: 'recent' });
        expect(parseHash('#/search')).toEqual({ name: 'search', query: '', type: 'stories', sort: 'popular' });
        expect(parseHash('#/past/2026-10-28')).toEqual({ name: 'past', day: '2026-10-28' });
        expect(parseHash('#/past')).toEqual({ name: 'past', day: shiftDay(today(), -1) });
        expect(parseHash('#/comments')).toEqual({ name: 'comments' });
        expect(parseHash(fromHref('github.com'))).toEqual({ name: 'from', site: 'github.com' });
    });

    it('shifts UTC days across month and year ends', () => {
        expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
        expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
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
