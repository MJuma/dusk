import { useEffect, useMemo, useState } from 'preact/hooks';

import { refreshTick } from '../app/refresh';
import { userHref } from '../app/router';
import type { UserTab } from '../app/router';
import { hnUserUrl } from '../data/hn';
import { HnSource, source } from '../data/source';
import type { UserProfile } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';
import { timeAgo } from '../lib/time';
import { ActivityList } from '../listing/ActivityList';

interface UserViewProps {
    id: string;
    tab: UserTab;
}

function formatJoined(created: number): string {
    const date = new Date(created * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return `joined ${date} (${timeAgo(created)} ago)`;
}

/** A user's profile, like HN's, plus their recent submissions and comments. */
export function UserView({ id, tab }: UserViewProps) {
    const tick = refreshTick.value;
    const [profile, setProfile] = useState<UserProfile | null | undefined>(() => source.cachedUser(id));
    const search = useMemo(() => HnSource.activityQuery(id, tab === 'comments' ? 'comment' : 'story'), [id, tab]);

    useEffect(() => {
        let active = true;
        source.user(id)
            .then((loaded) => {
                if (active) {
                    setProfile(loaded);
                }
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [id, tick]);

    const about = useMemo(() => (profile?.about ? { __html: sanitizeHnHtml(profile.about) } : undefined), [profile]);

    if (profile === null) {
        return <main class="status">No such user: {id}</main>;
    }
    return (
        <main class="user">
            <header class="thread-head">
                <h1 class="thread-title">{id}</h1>
                <div class="story-meta">
                    {profile ? `${profile.karma.toLocaleString()} karma · ${formatJoined(profile.created)} · ` : ''}
                    <a href={hnUserUrl(id)} target="_blank" rel="noopener noreferrer">
                        Open on HN
                    </a>
                </div>
                {about && <div class="thread-text" dangerouslySetInnerHTML={about} />}
                <nav class="user-tabs" aria-label="Activity">
                    <a class="tab" href={userHref(id)} aria-current={tab === 'submissions' ? 'page' : undefined}>
                        Submissions
                    </a>
                    <a class="tab" href={userHref(id, 'comments')} aria-current={tab === 'comments' ? 'page' : undefined}>
                        Comments
                    </a>
                </nav>
            </header>
            <ActivityList key={tab} search={search} empty={`No ${tab} yet.`} showAuthors={false} />
        </main>
    );
}
