import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import type { Story, Thread } from '../data/types';
import { fetchReadable, parseReaderResponse, readerUrl } from './article';
import { deleteSaved, getSavedArticle, getSavedThread, listSaved, putArticle, putThread } from './store';

function story(id: number): Story {
    return { id, type: 'story', title: `Story ${id}`, url: `https://example.com/${id}`, domain: 'example.com', by: 'pg', score: 1, time: 0, descendants: 1, text: null };
}

function thread(id: number): Thread {
    return {
        story: story(id),
        complete: true,
        unavailable: 0,
        comments: [{
            id: id * 10, parentId: id, depth: 0, author: 'a', html: 'hi', time: 0, collapsedByDefault: false, placeholder: false,
            topLevelIndex: 0, siblingIndex: 0, childCount: 0, descendantCount: 0,
        }],
    };
}

const LONG_TEXT = 'Readable text. '.repeat(20);

function reply(status: number, body: unknown): typeof fetch {
    return async () => new Response(JSON.stringify(body), { status });
}

describe('offline store', () => {
    it('keeps comments and article for a story on one record, and removes both', async () => {
        await putThread(thread(1), 1000);
        await putArticle(story(1), { url: 'https://example.com/1', title: 'Title', markdown: LONG_TEXT }, 2000);

        const record = (await listSaved()).find((saved) => saved.id === 1);
        expect(record).toMatchObject({ id: 1, savedAt: 2000, comments: { savedAt: 1000, count: 1 }, article: { savedAt: 2000, title: 'Title' } });
        expect((await getSavedThread(1))?.thread.comments[0]?.html).toBe('hi');
        expect((await getSavedArticle(1))?.markdown).toBe(LONG_TEXT);

        await deleteSaved(1);
        expect((await listSaved()).some((saved) => saved.id === 1)).toBe(false);
        expect(await getSavedThread(1)).toBeUndefined();
        expect(await getSavedArticle(1)).toBeUndefined();
    });

    it('updating comments keeps a previously saved article', async () => {
        await putArticle(story(2), { url: 'https://example.com/2', title: 'T', markdown: LONG_TEXT }, 1000);
        await putThread(thread(2), 3000);

        const record = (await listSaved()).find((saved) => saved.id === 2);
        expect(record?.article?.savedAt).toBe(1000);
        expect(record?.comments?.savedAt).toBe(3000);
    });
});

describe('reader service', () => {
    it('asks the reader for the page without its fragment', () => {
        expect(readerUrl('https://example.com/a?b=1#c')).toBe('https://r.jina.ai/https://example.com/a?b=1');
    });

    it('accepts readable text and rejects near-empty pages', () => {
        expect(parseReaderResponse({ data: { title: 'T', content: LONG_TEXT } })).toEqual({ title: 'T', markdown: LONG_TEXT.trim() });
        expect(() => parseReaderResponse({ data: { title: 'T', content: 'Subscribe to read' } })).toThrow(/No readable text/);
        expect(() => parseReaderResponse(null)).toThrow(/No readable text/);
    });

    it('explains reader failures', async () => {
        await expect(fetchReadable('https://x.test', reply(429, {}))).rejects.toThrow(/rate limiting/);
        await expect(fetchReadable('https://x.test', reply(422, { message: 'blocked' }))).rejects.toThrow(/couldn't load this page: blocked/);
        await expect(fetchReadable('https://x.test', reply(200, { data: { content: LONG_TEXT } }))).resolves.toMatchObject({ markdown: LONG_TEXT.trim() });
    });
});
