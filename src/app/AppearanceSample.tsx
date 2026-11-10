import type { Story } from '../data/types';
import { StoryRow } from '../feed/StoryRow';

// A negative id can't match a real story, so nothing (visits, saved stories) applies to it.
const STORY: Story = {
    id: -1,
    type: 'story',
    title: 'Show HN: Example',
    url: null,
    domain: 'example.com',
    by: 'maple',
    score: 128,
    time: Math.floor(Date.now() / 1000) - 3 * 3600,
    descendants: 42,
    text: null,
};

interface SampleReply {
    author: string;
    /** A hue from nameHue's palette, as a real thread would give the name. */
    hue: number;
    age: string;
    depth: number;
    isNew?: boolean;
    body: preact.ComponentChild;
}

const SAMPLE_REPLIES: readonly SampleReply[] = [
    { author: 'tern', hue: 195, age: '50 minutes ago', depth: 0, body: 'Example comment.' },
    {
        author: STORY.by,
        hue: 0,
        age: '40 minutes ago',
        depth: 1,
        body: (
            <>
                Thanks! Notes at <a href="https://example.com">example.com</a>.
            </>
        ),
    },
    { author: 'quietfox', hue: 275, age: '5 minutes ago', depth: 2, isNew: true, body: 'Works well on a phone, too.' },
];

const REPLIES = SAMPLE_REPLIES.map((reply) => ({ ...reply, style: { '--d': reply.depth, '--name-h': reply.hue } }));

/**
 * A story and a few replies, so appearance settings show as they change. The story is the real
 * row; the replies copy CommentRow's markup, since importing it here splits the first-paint
 * bundle. Inert: it's a picture, not something to click.
 */
export function AppearanceSample() {
    return (
        <div class="set-sample" inert>
            <div class="set-sample-frame">
                <ol class="stories">
                    <StoryRow story={STORY} rank={1} />
                </ol>
                <section class="comments">
                    {REPLIES.map((reply) => {
                        let classes = reply.depth === 0 ? 'c c-top' : 'c';
                        if (reply.isNew) {
                            classes += ' c-new';
                        }
                        return (
                            <article key={reply.author} class={classes} style={reply.style} data-hue={reply.depth % 8}>
                                <header class="c-head">
                                    <span class={reply.author === STORY.by ? 'c-author c-op' : 'c-author'}>{reply.author}</span>
                                    <span class="c-age">{reply.age}</span>
                                    {reply.isNew && <span class="c-new-badge">new</span>}
                                </header>
                                <div class="c-body">{reply.body}</div>
                            </article>
                        );
                    })}
                </section>
            </div>
        </div>
    );
}
