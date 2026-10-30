const ALLOWED = new Set(['A', 'B', 'BR', 'CODE', 'EM', 'I', 'P', 'PRE', 'STRONG']);
const DROPPED = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH']);
const HN_ITEM = /^https?:\/\/news\.ycombinator\.com\/item\?id=(\d+)(?:#\d+)?$/i;

function clean(parent: ParentNode): void {
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
        clean(element);
        if (!ALLOWED.has(element.tagName)) {
            element.replaceWith(...element.childNodes);
            continue;
        }
        const href = element.tagName === 'A' ? element.getAttribute('href') : null;
        for (const attribute of Array.from(element.attributes)) {
            element.removeAttribute(attribute.name);
        }
        if (element.tagName !== 'A') {
            continue;
        }
        if (!href || !/^https?:\/\//i.test(href)) {
            element.replaceWith(...element.childNodes);
            continue;
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
}

/**
 * Reduces HN comment HTML to the small tag set HN itself emits. Only http(s) links survive, and
 * links to HN items are rewritten to open inside Dusk. Parsing happens in an inert <template>, so
 * nothing in the input can execute or load while it is being cleaned.
 */
export function sanitizeHnHtml(html: string): string {
    const template = document.createElement('template');
    template.innerHTML = html;
    clean(template.content);
    return template.innerHTML;
}
