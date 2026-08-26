#!/usr/bin/env sh

set -eu

if [ ! -f docs/wiki/Home.md ]; then
  echo 'Run this command from the Atlore repository root.' >&2
  exit 1
fi

main_remote=$(git remote get-url origin)
if [ -n "${WIKI_REMOTE:-}" ]; then
  wiki_remote=$WIKI_REMOTE
elif [ "${main_remote%.git}" != "$main_remote" ]; then
  wiki_remote="${main_remote%.git}.wiki.git"
else
  wiki_remote="${main_remote}.wiki.git"
fi

wiki_worktree=$(mktemp -d /tmp/atlore-wiki.XXXXXX)
cleanup() {
  case "$wiki_worktree" in
    /tmp/atlore-wiki.*) rm -rf -- "$wiki_worktree" ;;
  esac
}
trap cleanup EXIT HUP INT TERM

if ! git clone "$wiki_remote" "$wiki_worktree"; then
  echo >&2
  echo 'The GitHub Wiki has not been initialized yet.' >&2
  echo 'Create and save the first Home page in the GitHub Wiki, then run this command again.' >&2
  exit 1
fi

for source_page in docs/wiki/*.md; do
  cp "$source_page" "$wiki_worktree/$(basename "$source_page")"
done

git -C "$wiki_worktree" add -- '*.md'
if git -C "$wiki_worktree" diff --cached --quiet; then
  echo 'GitHub Wiki is already up to date.'
  exit 0
fi

git -C "$wiki_worktree" commit -m 'docs: update Atlore wiki'
git -C "$wiki_worktree" push origin HEAD
echo 'GitHub Wiki published.'
