# Dusk

A fast, dark-first Hacker News reader. It's a static PWA hosted on GitHub Pages, with no backend.

## How it reads HN

`news.ycombinator.com` doesn't allow cross-origin reads, so Dusk combines HN's two public APIs:

- **Algolia** (`/api/v1/items/:id`) returns a whole thread in one request, but in chronological order.
- **Firebase** (`/v0/item/:id`) returns `kids` in HN's ranked order. Dusk fetches it only for comments with two or more replies, and for replies Algolia lacks: comments too new to be indexed, and dead comments that HN keeps collapsed because they have live replies.

`src/data/thread.logic.ts` merges the two sources. The fixture tests check the result against HN's own rendered page: order, depth, and which comments start collapsed or hidden.

Voting, replying, submitting, flagging and favoriting open the matching HN page.

## Commands

```bash
pnpm dev          # local dev server
pnpm build        # typecheck + production build (pass --base /<repo>/ for Pages)
pnpm lint         # oxlint, type-aware
pnpm test         # vitest
pnpm fixtures <storyId> <name>                     # capture a thread fixture from HN, Algolia and Firebase
node scripts/measure.mjs <url> <storyId> [runs]    # time Dusk vs HN in emulated iPhone WebKit/Chromium
```

Pushing to `master` deploys to GitHub Pages (`.github/workflows/deploy.yml`).
