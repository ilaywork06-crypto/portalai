# Portal AI — Leg 1

Marketplace, Community and Usage for Portal AI. The UI is in Hebrew (RTL) and served under `/AI`.

It is a monorepo:

- **Backend:** four FastAPI microservices plus a shared kernel, managed as one uv workspace.
- **Frontend:** a React + TypeScript app.
- **Gateway:** NGINX, routing each `/AI/api/...` prefix to the service that owns it.
- **Database:** Postgres, with one database per service.

**Hebrew guide for running and using the system: [docs/guide.he.md](docs/guide.he.md)**

## Quick start

```bash
make dev        # docker compose up --build → http://localhost:8080/AI/
```

The first start runs the migrations and loads the demo data. Choose how sign-in works per run:

| Command | SSO button |
|---|---|
| `make dev` | A stand-in IdP signs you in at once as `alon.cohen` (`SSO_MODE=dev`) |
| `make dev sso=keycloak` | Real OpenID Connect sign-in against a local Keycloak (`docker-compose.sso.yml`, http://localhost:8180) |
| `make dev sso=off` | Hidden; username and password only (`SSO_MODE=off`) |

Every mode also accepts a password:

| User | Password | Notes |
|---|---|---|
| `alon.cohen` | `portal123` | Section head. Sees "AI under me" for מדור פלטפורמות נתונים |
| `elad.biton` | `portal123` | Engineer. Sees only "My AI" |
| `portal.admin` | `portal123` | Admin. The API lets it edit and delete any content (the UI shows those buttons only to the author) |

Run `make help` to list every command. The most used: `make test`, `make lint`, `make reset` (wipe the data and re-seed), and `make migration svc=community m="…"`.

## Architecture

```
browser ──► gateway (nginx :8080)
              ├─ /AI/api/auth/*             → auth         ─┐
              ├─ /AI/api/market/*           → marketplace   │ FastAPI services,
              ├─ /AI/api/{posts,uploads}/*  → community     │ one Postgres database each
              ├─ /AI/api/{usage,org}/*      → usage        ─┘
              ├─ /AI/api/docs/<service>     → that service's OpenAPI docs
              └─ /AI/*                      → frontend (Vite in dev, static nginx in prod)
```

- **Auth** issues a signed session (a JWT in an `HttpOnly` cookie on `/AI`). Every service validates it with `portal-kit`, so there is no extra hop per request.
- **SSO** is a redirect round trip: `/auth/sso/start` → IdP → `/auth/sso/callback`. `SSO_MODE` picks the IdP:
  - `oidc`: any OpenID Connect provider (Entra ID, Okta, ADFS, Keycloak). It uses the authorization code flow with PKCE and verifies the ID token (signature via JWKS, issuer, audience, expiry, nonce).
  - `dev`: a stand-in that signs in `SSO_DEV_USERNAME`. Production refuses it unless `ALLOW_DEV_IDENTITY_PROVIDER=true`.
  - `off`: password sign-in only.

  A signed, short-lived `portal_sso` cookie ties the callback to the browser that started the sign-in. `GET /auth/methods` tells the login page whether to show SSO.
- **Publishing** in Marketplace or Community requires `visibilityAck { confirmed, textVersion }`. The server rejects a missing ack and a stale copy version.
- **Usage** computes every metric on the server, at query time, from daily rollups and the environment config (`usage_config.json`: work hours, peaks, models, prices). It enforces the manager subtree on every endpoint. The metrics engine reproduces the design file float for float; `services/usage/tests/test_engine_parity.py` checks this against golden data.
- **Rate limiting:** the gateway limits the login endpoint.

## Repository layout

```
libs/portal-kit/          shared kernel: app factory, settings, DB/unit of work, JWT principal, errors, visibility ack
services/<name>/
  src/portal_<name>/
    domain/               entities, value objects, rules, repository ports (no framework code)
    application/          use cases (services) working through a unit of work
    infrastructure/       SQLAlchemy models and repositories, storage, seed data
    api/                  FastAPI routes and Pydantic schemas (camelCase on the wire)
    main.py               composition root (create_app factory)
    cli.py                `python -m portal_<name>.cli seed`
  migrations/             Alembic (per service)
  tests/                  pytest (SQLite in memory; usage also checks parity with the reference)
frontend/src/
  app/                    shell, router, providers (TanStack Query, toasts)
  features/<area>/        api.ts (typed client + query hooks), components, page
  shared/                 http client, UI primitives, hooks, styles, fonts
deploy/
  docker/service.Dockerfile  one multi-stage image recipe for every Python service (dev and runtime targets)
  gateway/                   nginx template (dev mounts it; prod bakes it into an image)
  postgres/init/             one database and role per service
docker-compose.yml           development (hot reload, mounted sources, demo seed)
docker-compose.sso.yml       development overlay: Keycloak as a real OpenID Connect IdP (realm in deploy/keycloak/)
docker-compose.prod.yml      release images (non-root, migrations on start, 2 workers)
docs/guide.he.md             running and using the system (Hebrew)
```

## Development without Docker

```bash
make install
docker compose up -d postgres            # or point DATABASE_URL at any Postgres
cd services/community
DATABASE_URL=postgresql+asyncpg://community_svc:community_dev@localhost:5433/community \
JWT_SECRET=dev-only-secret-change-me-in-production-0001 \
  uv run alembic upgrade head && uv run uvicorn --factory portal_community.main:create_app --reload --port 8003
cd frontend && npm run dev               # proxies /AI/api to the gateway (VITE_API_PROXY)
```

## Production

```bash
JWT_SECRET=$(openssl rand -hex 32) make prod      # → http://localhost:8080/AI/
```

- **Images:** `portal-ai/{auth,marketplace,community,usage,web,gateway}`. Services run as uid 10001 with health checks on `/readyz`.
- **Before a real deployment:**
  - Set `SEED_DEMO_DATA=false`.
  - Use a managed Postgres with real per-service credentials.
  - Serve over HTTPS; session cookies are `Secure` by default.
  - Connect the corporate IdP. Set `SSO_MODE=oidc`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `PUBLIC_URL`, and register `<PUBLIC_URL>/AI/api/auth/sso/callback` at the IdP. The Hebrew guide has the details.

## Where the design file and the spec disagree

The UI matches the design file pixel for pixel. This was checked with screenshot diffs at 1440, 768 and 360 px wide, against the full stack and against the release build. Where the design file and the spec disagree, the app follows the file. These need a decision:

1. **"By model" card** shows a warning box with a savings estimate when premium models take more than 55% of tokens. The spec says no auto-generated insights.
2. **Users table in "AI under me"** has a CSV button. The spec removes "Export" buttons.
3. **"Newest" sort in Marketplace** keeps the catalog order, which is newest listed first. It does not sort by `publishedAt`.
4. **At 360 px** the page is 16 px wider than the screen, as in the design file.
5. **MCP repo** is optional when publishing; the spec lists it as required.
6. **No success toasts**, as in the design file. Errors do show a toast.

Deliberate changes from the design file:

- New posts, replies and uploads show the signed-in user's real name instead of "אתם".
- Upload dates use the long format, as the catalog does.
- With the work-hours filter, "AI under me" shows quiet hours as "—", as "My AI" already did.
- Search captions use real quote marks (the design file printed `“`).
- A new upload must pick a category.
- An Agent ZIP contains `README.md`.
- At 900 px wide and less, the date picker keeps its 7-column calendar. The design file's mobile rule stacked every inline grid, including the calendar, into one column.
- Images attached to posts get a white background when they are converted to JPEG, so transparent areas don't turn black.
