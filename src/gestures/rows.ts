import type { CommentTarget } from '../app/actions';
import type { Story } from '../data/types';

/** Stories in the lists on screen, by id, so a swipe on a story row can act on its story. */
export const shownStories = new Map<number, Story>();

/** The open thread's comments, for swipes on comments (set while a thread is shown). */
export const commentRows: { target?: (id: number) => CommentTarget | undefined } = {};
