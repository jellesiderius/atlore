# Contributing to Atlore

Thanks for helping improve Atlore.

## Local workflow

1. Install Node.js 22+, Docker Compose and GNU Make.
2. Run `cp .env.example .env && npm install`.
3. Start dependencies with `make infra`, then run `make migrate` and `make seed`.
4. Start Vite with `npm run dev`.
5. Before opening a pull request, run `make check`, `npm run build` and `make e2e`.

Keep UI additions component-based and preserve server-side permission checks for every new API path. Add a focused unit or Playwright regression test for behavioral changes. Never commit `.env`, credentials, uploaded files or production data.

The version-controlled source for the GitHub Wiki lives in `docs/wiki/`. Update those pages together with user-facing behavior and run `make publish-wiki` after merging documentation changes. GitHub requires its first Wiki page to be initialized in the web interface before the Wiki Git remote can be cloned.

## Releases

Release preparation and publication are maintainer-controlled. Do not change the package version, create or push a version tag, or start the release workflow without explicit approval for a specific version. See [docs/RELEASING.md](./docs/RELEASING.md) for the gated process; every published release is derived from and links back to [CHANGELOG.md](./CHANGELOG.md).

For security issues, use GitHub's private security advisory flow rather than a public issue.
