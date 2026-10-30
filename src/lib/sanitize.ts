interface Policy {
    tags: ReadonlySet<string>;
}

/** The small tag set HN itself emits in comments and text posts. */
const COMMENT_POLICY: Policy = {
    tags: new Set(['A', 'B', 'BR', 'CODE', 'EM', 'I', 'P', 'PRE', 'STRONG']),
};

/** Reader-mode articles (Markdown rendered to HTML) also use structure and images. */
const ARTICLE_POLICY: Policy = {
    tags: new Set([
        ...COMMENT_POLICY.tags,
        'BLOCKQUOTE', 'DEL', 'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'IMG', 'LI', 'OL', 'S',
        'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'UL',
    ]),
};

const DROPPED = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH']);
const HN_ITEM = /^https?:\/\/news\.ycombinator\.com\/item\?id=(\d+)(?:#\d+)?$/i;

function cleanLink(element: Element, href: string | null): void {
    if (!href || !/^https?:\/\//i.test(href)) {
        element.replaceWith(...Array.from(element.childNodes));
        return;
    }
    const hnItem = HN_ITEM.exec(href);
    if (hnItem) {
        element.setAttribute('href', `#/item/${hnItem[1]}`);
    } else {
        element.setAttribute('href', href);
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer nofollow');
    }
}

function cleanImage(element: Element, src: string | null, alt: string | null): void {
    if (!src || !/^https:\/\//i.test(src)) {
        element.remove();
        return;
    }
    element.setAttribute('src', src);
    element.setAttribute('alt', alt ?? '');
    element.setAttribute('loading', 'lazy');
    element.setAttribute('decoding', 'async');
    element.setAttribute('referrerpolicy', 'no-referrer');
}

function clean(parent: ParentNode, policy: Policy): void {
    // Copy the live NodeList: nodes are removed and replaced while iterating.
    for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            node.remove();
            continue;
        }
        const element = node as Element;
        if (DROPPED.has(element.tagName)) {
            element.remove();
            continue;
        }
        clean(element, policy);
        if (!policy.tags.has(element.tagName)) {
            element.replaceWith(...Array.from(element.childNodes));
            continue;
        }
        const href = element.getAttribute('href');
        const src = element.getAttribute('src');
        const alt = element.getAttribute('alt');
        for (const attribute of Array.from(element.attributes)) {
            element.removeAttribute(attribute.name);
        }
        if (element.tagName === 'A') {
            cleanLink(element, href);
        } else if (element.tagName === 'IMG') {
            cleanImage(element, src, alt);
        }
    }
}

function sanitize(html: string, policy: Policy): string {
    const template = document.createElement('template');
    template.innerHTML = html;
    clean(template.content, policy);
    return template.innerHTML;
}

/**
 * Reduces HN comment HTML to the small tag set HN itself emits. Only http(s) links survive, and
 * links to HN items are rewritten to open inside Dusk. Parsing happens in an inert <template>, so
 * nothing in the input can execute or load while it is being cleaned.
 */
export function sanitizeHnHtml(html: string): string {
    return sanitize(html, COMMENT_POLICY);
}

/** Like sanitizeHnHtml, but keeps article structure (headings, lists, quotes, tables) and https images. */
export function sanitizeArticleHtml(html: string): string {
    return sanitize(html, ARTICLE_POLICY);
}
