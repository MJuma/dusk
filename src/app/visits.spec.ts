// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { getVisit, markSeen, parseVisit, recordLinkOpen, recordThreadLoad } from './visits';

describe('visits', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('records a thread load and forgets new comments once seen', () => {
        recordThreadLoad(7, { count: 12, maxId: 900, unseen: [801, 802, 803] });
        markSeen(7, [802, 999]);

        expect(getVisit(7)).toMatchObject({ count: 12, maxId: 900, unseen: [801, 803] });
        expect(parseVisit(localStorage.getItem('dusk:visit:7'))).toEqual(getVisit(7));
    });

    it('never lowers the high-water mark', () => {
        recordThreadLoad(8, { count: 3, maxId: 500, unseen: [] });
        recordThreadLoad(8, { count: 2, maxId: 400, unseen: [] });

        expect(getVisit(8)?.maxId).toBe(500);
    });

    it('keeps link and comment visits on the same record', () => {
        recordLinkOpen(9);
        recordThreadLoad(9, { count: 1, maxId: 10, unseen: [] });

        expect(getVisit(9)).toMatchObject({ linkAt: expect.any(Number), commentsAt: expect.any(Number) });
    });

    it('ignores malformed stored data', () => {
        expect(parseVisit('not json')).toBeUndefined();
        expect(parseVisit('{"maxId":"9","unseen":[1,"x",2]}')).toEqual({ unseen: [1, 2] });
    });
});
