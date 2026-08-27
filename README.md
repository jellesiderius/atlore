<p align="center">
  <img src="./static/brand/atlore-wide.png" alt="Atlore — open-source tabletop RPG campaign manager" width="760" />
</p>

# Atlore

Atlore is an open-source, realtime tabletop RPG campaign manager and collaborative worldbuilding knowledge graph. Designed for Dungeons & Dragons (D&D) and other TTRPGs, it combines an Obsidian-style graph view, `@`-linked session notes, interactive maps, and multiplayer worldbuilding tools. The application preserves the supplied Claude prototype's visual language in both dark and light mode.

## Quick start

Requirements: Docker Desktop (or Docker Engine with Compose), GNU Make, and optionally Node.js 22+ for local development.

```bash
cp .env.example .env
make up
make seed
```

Then open [http://localhost:3000](http://localhost:3000). The demo data includes two accounts:

- `demo@atlore.app` / `AtloreDemo!2026` (game master)
- `lena@atlore.app` / `AtloreDemo!2026` (player)

Change all example passwords and secrets before making the stack publicly accessible.

## Documentation

New to Atlore? Follow the [Getting Started guide](https://github.com/jellesiderius/atlore/wiki/Getting-Started) from account creation to your first collaborative session. The complete [Atlore Wiki](https://github.com/jellesiderius/atlore/wiki) also covers campaign permissions, graph controls, nodes, maps, realtime collaboration, account settings, self-hosting, and troubleshooting.

## Everyday commands

```bash
make help       # list all available commands
make up         # build and start the production stack
make down       # shut down containers while preserving data
make stop       # stop containers
make restart    # restart containers
make logs       # follow application logs
make status     # show health and container status
make seed       # load idempotent demo data
make seed-10k   # create a 10,000-node performance world for LOAD_TEST_EMAIL
make check      # run type checking, linting, and unit tests
make e2e        # run Playwright on desktop and mobile
make test-10k   # run the real Chromium load test with a frame budget
make clean      # remove generated files only
make destroy    # remove containers and volumes after confirmation
```

For a fast local development cycle:

```bash
npm install
make infra
make migrate
npm run dev
```

The Vite server runs at [http://localhost:5173](http://localhost:5173) by default. The Docker production application uses port `3000`.

## Architecture

The codebase follows a component-based architecture. Route components orchestrate state and API calls, while domain logic, server services, and visual components remain separate.

```text
src/
├── lib/components/
│   ├── auth/          authentication screens
│   ├── campaign/      campaign cards and management
│   ├── graph/         canvas, worker, and graph controls
│   ├── map/           maps and markers
│   ├── node/          dossiers, relationships, and node creation
│   ├── richtext/      shared editor, viewer, and node chips
│   ├── session/       session editor and story view
│   ├── ui/            modals, icons, menus, and notifications
│   └── workspace/     navigation, search, history, and management
├── lib/domain/        pure, tested search, ACL, text, and diff logic
├── lib/i18n/          translation catalogs, locale state, and server translations
├── lib/server/        authentication, configuration, database, mail, storage, and services
├── routes/api/        validated SvelteKit JSON endpoints
└── workers/           force layout outside the main thread
```

The stack consists of:

- SvelteKit 2 and Svelte 5, TypeScript, Vite, and Tailwind CSS 4;
- YAML catalogs for Dutch and English interface, API, and email copy;
- PostgreSQL 17 with Drizzle ORM and version-controlled SQL migrations;
- Redis for rate limiting and realtime invalidation;
- WebSockets for updates between concurrent campaign users;
- S3-compatible object storage, provided locally by MinIO;
- Argon2 password hashing and hashed session and recovery tokens;
- a service worker and web manifest for PWA installation;
- Vitest and Playwright for unit, API, desktop, and mobile tests.

Composer is intentionally not included because Atlore has no PHP runtime or PHP packages. `npm` manages the JavaScript toolchain, while database and infrastructure dependencies run as pinned containers. An empty Composer configuration would not add any production functionality.

## Features

- account registration, sign-in, sign-out, and password recovery;
- multiple campaigns, invitations, member roles, and 15 configurable player permissions;
- twelve built-in node types and support for custom node types;
- an interactive force graph with search, filtering, dragging, reflow, and context menus;
- Obsidian-style connected swarm dragging with a focus backdrop and worker-based layout;
- node dossiers with shared descriptions, personal notes, images, maps, relationships, and story references;
- rich session text with `@` autocomplete, silent matches, and automatically derived relationships;
- session views, a continuous story, personal session notes, and version restoration;
- an atlas with image upload, pan and zoom, drag-and-drop markers, and locking;
- a trash system for nodes and sessions, including restoration and permanent deletion;
- a game-master-as-player view that is filtered server-side and read-only in the interface;
- realtime updates, dark and light mode, responsive mobile navigation, and PWA caching.

## Translations and snippets

All interface, error, and email copy lives in `src/lib/i18n/locales/nl.yaml` and `src/lib/i18n/locales/en.yaml`. Dutch is the default language. The selected language is stored in both `localStorage` and the `atlore_locale` cookie so Svelte components, server responses, and emails use the same language.

Add copy to both YAML files under the same semantic key:

```yaml
campaign:
  welcome: Welcome to {{title}}
```

Then use the snippet in a component:

```svelte
<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
</script>

<h1>{t('campaign.welcome', { title: campaign.title })}</h1>
```

Server code uses `serverT()` from `src/lib/i18n/server.ts`. Unit tests automatically verify that both catalogs contain identical keys and interpolation fields, and that every statically used `t('…')` key exists.

## Configuration

All configuration is supplied through `.env`; the server validates these values on startup. See [`.env.example`](./.env.example) for the complete list.

Important production settings:

- set `NODE_ENV=production`;
- set `ORIGIN` to the exact public HTTPS origin;
- add any additional permitted preview or proxy domains to `TRUSTED_ORIGINS` as a comma-separated list;
- generate strong, unique values for `POSTGRES_PASSWORD`, `REALTIME_SECRET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`;
- configure SMTP for real recovery and invitation emails;
- terminate TLS at a reverse proxy or load balancer;
- accept proxy headers only from a trusted proxy;
- create regular backups of PostgreSQL and the object-storage bucket.

Without S3 configuration, the application falls back to `STORAGE_PATH`. Without Redis, the application remains functional with process-local rate limiting, but horizontal realtime synchronization requires Redis.

## Database and migrations

SQL migrations live in `drizzle/` and are applied by the one-shot `migrate` service when running `make up`.

```bash
npm run db:generate  # generate a migration after schema changes
npm run db:migrate   # apply migrations
npm run db:seed      # idempotently populate the demo world
npm run db:studio    # open Drizzle Studio
```

For example, create a PostgreSQL backup with:

```bash
docker compose exec -T postgres pg_dump -U atlore -Fc atlore > atlore.backup
```

## Quality checks

```bash
npm run check        # Svelte and TypeScript
npm run lint         # ESLint for TypeScript, JavaScript, and Svelte
npm test             # pure domain unit tests
npm run test:e2e     # API and browser flows on desktop and mobile
npm run test:load    # 10k nodes: load time, movement, FPS, and long tasks
npm run build        # adapter-node production build
```

Install the Playwright browser once if it is not yet available locally:

```bash
npx playwright install chromium
```

The health endpoint is available at `/api/health` and reports PostgreSQL and Redis status. Docker monitors this endpoint automatically.

For the reproducible 10k-node test:

```bash
make seed-10k
make test-10k
```

By default, the campaign is created for the bundled demo account. Select another existing account with `LOAD_TEST_EMAIL=name@example.com make seed-10k`, and use the same variable with `make test-10k`. The large graph uses a Web Worker for its initial layout, batched Canvas 2D paths, and a lighter interactive simulation to keep the main thread responsive.

## Security model

All mutations validate their input with Zod and reapply campaign ACLs and node visibility on the server. Hidden nodes are excluded from player payloads. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when using an HTTPS origin; non-idempotent requests include an origin check. Responses include CSP, framing, MIME, referrer, and permissions protections. Realtime tokens are short-lived and HMAC-signed.

## Contributing and license

Issues and pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the short development workflow. Atlore is released under the [MIT License](./LICENSE).
