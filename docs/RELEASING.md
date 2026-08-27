# Releasing Atlore

Atlore releases are deliberately gated by explicit maintainer approval. A push, merge, or tag does **not** automatically publish a GitHub Release. Do not change the project version, create a release heading, create or push a tag, or run the release workflow until the maintainer explicitly approves a specific version.

## Release flow

After a version such as `1.1.0` has been explicitly approved:

1. Update `package.json` and `package-lock.json` to the approved version without creating a tag:

   ```bash
   npm version 1.1.0 --no-git-tag-version
   ```

2. Move the relevant entries from `Unreleased` in `CHANGELOG.md` into a dated heading:

   ```markdown
   ## [1.1.0] - YYYY-MM-DD
   ```

3. Add comparison links at the bottom of `CHANGELOG.md`, leave a new empty `Unreleased` section at the top, and commit the release preparation.
4. Push `main` and wait for the CI run for that exact commit to pass completely.
5. Start the manual **Create release** workflow from GitHub Actions, or run:

   ```bash
   make release VERSION=1.1.0
   ```

6. Confirm the prompt. The workflow revalidates the version, changelog section, tag target, existing release, and successful CI run before creating `v1.1.0` and its GitHub Release.
7. Verify the release page and downloadable GitHub source archives.

Release notes are extracted from the matching `CHANGELOG.md` section. The workflow always appends a permanent link to the complete changelog at the released tag.

## Prereleases

Use a valid SemVer prerelease such as `1.2.0-beta.1`, prepare the files in the same way, then run:

```bash
make release VERSION=1.2.0-beta.1 PRERELEASE=true
```

The workflow marks it as a GitHub prerelease and does not mark it as the latest stable release.

## Existing tags

The workflow can use an existing `vVERSION` tag only when it points to the exact approved `main` commit. It refuses to move tags and refuses to overwrite an existing GitHub Release.
