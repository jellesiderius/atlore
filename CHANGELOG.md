# Changelog

All notable changes to Atlore are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Atlore uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). A version is moved out of **Unreleased** only after explicit maintainer approval.

## [Unreleased]

## [1.1.0] - 2026-08-27

### Added

- Optional remotely-managed Cloudflare Tunnel deployment profile, validation, operations commands, CI coverage, and self-hosting guide.
- Mobile two-finger pinch zoom for the knowledge graph.
- Mobile tap previews for nodes pinned to an atlas map.
- English as the initial interface language while retaining per-account language preferences.
- A small version and source-commit identifier on auth and campaign overview screens.
- An approval-gated GitHub release workflow with changelog-derived release notes and automatic source archives.

### Changed

- Docker-published application, PostgreSQL, Redis, and MinIO ports bind to `127.0.0.1` by default.
- Node editors exclude the node being edited from `@` mention suggestions and automatic self-linking.
- Production Make targets embed the current Git commit in rebuilt Docker images so tunnel deployments can be verified visually.
- GitHub Actions use current Node.js 24-based action runtimes.

## [1.0.0] - 2026-08-27

### Added

- First public, self-hostable Atlore release.
- Component-based SvelteKit 2 and Svelte 5 application with TypeScript, Vite, and Tailwind CSS.
- PostgreSQL persistence and migrations with Redis-backed rate limiting and realtime fan-out.
- S3-compatible image and map storage with a bundled MinIO development service.
- Obsidian-style force graph with connected swarm dragging, curved links, focus states, hidden nodes, configurable forces, and a 10,000-node performance mode.
- Collaborative session and node editors with `@` mentions, automatic relationships, autosave, version history, private notes, presence, live cursors, and WebSockets.
- Campaign and node maps with uploads, drag-and-drop, linked markers, locking, and context actions.
- Game-master and player permissions, invitations, visibility controls, account settings, password changes, themes, and English/Dutch YAML translations.
- Responsive desktop and mobile navigation, installable PWA metadata, Docker Compose, Make commands, automated tests, CI, screenshots, and a complete GitHub Wiki.
- MIT license, contribution guide, funding configuration, demo campaign, and documented release archives.

[Unreleased]: https://github.com/jellesiderius/atlore/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/jellesiderius/atlore/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jellesiderius/atlore/releases/tag/v1.0.0
