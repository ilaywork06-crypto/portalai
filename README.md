# Portal AI — frontend

Marketplace, Community and Usage for Portal AI. The UI is in Hebrew (RTL) and is served under `/AI/`.

This branch holds only the frontend: a React + TypeScript app on Vite. It needs no backend. An in-browser mock API (`src/mock`) answers every `/AI/api/*` request from seeded demo data.

## Run

```bash
npm install
npm run dev     # → http://localhost:5173/AI/
```

Sign in with the SSO button (it signs you in as `alon.cohen` right away), or use a username and password:

| User | Password | Notes |
|---|---|---|
| `alon.cohen` | `portal123` | Section head. Also sees "AI under me" for מדור פלטפורמות נתונים |
| `elad.biton` | `portal123` | Engineer. Sees only "My AI" |
| `portal.admin` | `portal123` | Admin. Can edit and delete any content, and has no usage of their own |

## Demo data

- **Marketplace:** 21 items (MCPs, Skills, Agents, Plugins, an App). You can star, install, download a ZIP, and publish, edit or delete your own items.
- **Community:** seeded posts and replies. You can post (with attachments), reply, repost and mark posts helpful.
- **Usage:** 180 days of coding-tool usage for 476 people in a 110-node org tree. The metrics engine (`src/mock/usage/engine.ts`) was ported from the original server, and a test checks it against the reference golden data float for float.

Your changes are saved in `localStorage`, so they survive a reload. To go back to the seed, open any page with `?reset-demo`, for example http://localhost:5173/AI/?reset-demo.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the mock API |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the build (also runs on the mock API) |
| `npm test` | Vitest, including the usage engine parity test |
| `npm run lint` | ESLint |

## Layout

```
src/
  app/             shell, router, providers (TanStack Query, toasts)
  features/<area>  api.ts (typed client + query hooks), components, page
  shared/          http client, UI primitives, hooks, styles, fonts
  mock/            the in-browser API
    server.ts      patches fetch for /AI/api/*, routes requests, adds a little latency
    handlers/      auth, marketplace, community, usage
    usage/         usage metrics engine + parity test
    data/          seed JSON (catalog, posts, usage config and dataset)
```
