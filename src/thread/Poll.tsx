import { memo } from 'preact/compat';
import { useMemo } from 'preact/hooks';

import type { PollOption } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';

interface PollProps {
    options: PollOption[];
}

const PollRow = memo(function PollRow({ option, share }: { option: PollOption; share: number }) {
    const text = useMemo(() => ({ __html: sanitizeHnHtml(option.text) }), [option.text]);
    const bar = useMemo(() => ({ width: `${Math.round(share * 100)}%` }), [share]);
    return (
        <li class="poll-option">
            <div class="poll-text" dangerouslySetInnerHTML={text} />
            <div class="poll-meta">
                <span class="poll-bar" style={bar} />
                <span class="poll-score">{option.score.toLocaleString()} points</span>
            </div>
        </li>
    );
});

/** A poll's options with their votes, like HN shows them (voting happens on HN). */
export function Poll({ options }: PollProps) {
    const top = Math.max(1, ...options.map((option) => option.score));
    return (
        <ol class="poll" aria-label="Poll options">
            {options.map((option) => (
                <PollRow key={option.id} option={option} share={option.score / top} />
            ))}
        </ol>
    );
}
