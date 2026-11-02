// @vitest-environment jsdom
import { signal } from '@preact/signals';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { memo } from './memo';

describe('memo', () => {
    it('skips re-renders for equal props but still follows the signals it reads', async () => {
        const label = signal('a');
        const rendered = vi.fn();
        const Row = memo(({ id }: { id: number }) => {
            rendered();
            return <span>{`${id}${label.value}`}</span>;
        });
        const root = document.createElement('div');
        await act(() => {
            render(<Row id={1} />, root);
        });
        await act(() => {
            render(<Row id={1} />, root);
        });
        expect(rendered).toHaveBeenCalledTimes(1);

        await act(() => {
            label.value = 'b';
        });
        expect(root.textContent).toBe('1b');
    });
});
