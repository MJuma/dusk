// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sanitizeArticleHtml, sanitizeHnHtml } from './sanitize';

describe('sanitizeHnHtml', () => {
    it('keeps the formatting HN emits', () => {
        const html = 'One<p><i>two</i></p><p><pre><code>  three\n</code></pre>';

        expect(sanitizeHnHtml(html)).toBe(html.replace('<p><pre>', '<p></p><pre>'));
    });

    it('drops scripts and event handlers', () => {
        const html = 'a<script>alert(1)</script><img src=x onerror="alert(2)"><p onclick="alert(3)">b</p>';

        expect(sanitizeHnHtml(html)).toBe('a<p>b</p>');
    });

    it('unwraps non-http links and hardens external ones', () => {
        const html = '<a href="javascript:alert(1)">x</a> <a href="https://example.com/a" style="color:red">y</a>';

        expect(sanitizeHnHtml(html)).toBe('x <a href="https://example.com/a" target="_blank" rel="noopener noreferrer nofollow">y</a>');
    });

    it('opens links to HN items inside the app', () => {
        const html = '<a href="https://news.ycombinator.com/item?id=123#456">see</a>';

        expect(sanitizeHnHtml(html)).toBe('<a href="#/item/123">see</a>');
    });
});

describe('sanitizeArticleHtml', () => {
    it('keeps article structure', () => {
        const html = '<h2>Title</h2><ul><li>one</li></ul><blockquote><p>quote</p></blockquote><table><tbody><tr><td>x</td></tr></tbody></table>';

        expect(sanitizeArticleHtml(html)).toBe(html);
    });

    it('keeps https images only, loading lazily without a referrer', () => {
        const html = '<img src="https://example.com/a.png" alt="A" onerror="alert(1)"><img src="http://example.com/b.png"><img src="javascript:alert(1)">';

        expect(sanitizeArticleHtml(html)).toBe('<img src="https://example.com/a.png" alt="A" loading="lazy" decoding="async" referrerpolicy="no-referrer">');
    });

    it('still drops scripts, styles and unsafe links', () => {
        const html = '<style>p{}</style><p style="x">a<script>1</script> <a href="javascript:x">b</a></p>';

        expect(sanitizeArticleHtml(html)).toBe('<p>a b</p>');
    });
});
