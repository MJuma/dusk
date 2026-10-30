import { describe, expect, it } from 'vitest';

import { algoliaActivityUrl, commentFromHit, storyFromHit } from './hn';

describe('Algolia activity', () => {
    it('asks for a user\'s newest stories or comments with only the fields Dusk shows', () => {
        const url = new URL(algoliaActivityUrl('pg', 'comment', 2));

        expect(url.pathname).toBe('/api/v1/search_by_date');
        expect(url.searchParams.get('tags')).toBe('comment,author_pg');
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.get('attributesToRetrieve')).toContain('story_title');
    });

    it('maps story hits, treating an empty URL as a text post', () => {
        const story = storyFromHit({ objectID: '42', author: 'pg', created_at_i: 100, title: 'Ask HN: x', url: '', points: 5, num_comments: 3, story_text: '<p>hi' });

        expect(story).toEqual({ id: 42, type: 'story', title: 'Ask HN: x', url: null, domain: null, by: 'pg', score: 5, time: 100, descendants: 3, text: '<p>hi' });
        expect(storyFromHit({ objectID: '1', author: 'a', created_at_i: 1, url: 'https://www.example.com/a' }).domain).toBe('example.com');
    });

    it('maps comment hits with the story they belong to', () => {
        const comment = commentFromHit({ objectID: '7', author: 'pg', created_at_i: 100, story_id: 3, story_title: 'Title', comment_text: 'text' });

        expect(comment).toEqual({ id: 7, storyId: 3, storyTitle: 'Title', html: 'text', time: 100 });
    });
});
