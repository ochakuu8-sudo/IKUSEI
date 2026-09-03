#!/usr/bin/env bash
# Build the prototype and publish it to the gh-pages branch.
#
# GitHub Pages serves this repository from the gh-pages branch
# ("Deploy from a branch"), not from Actions, so publishing is a local
# build pushed to that branch. See CLAUDE.md for the full picture.
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

if [ -n "$(git status --porcelain)" ]; then
  echo "deploy: working tree is dirty -- commit or stash before deploying." >&2
  exit 1
fi

SOURCE_SHA=$(git rev-parse --short HEAD)
SOURCE_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ ! -d node_modules ]; then
  npm ci
fi
npm run build

WORKTREE="$(mktemp -d)/gh-pages"
cleanup() {
  git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  rm -rf "$(dirname "$WORKTREE")"
}
trap cleanup EXIT

git fetch origin gh-pages
git worktree add --force "$WORKTREE" -B gh-pages origin/gh-pages >/dev/null

# Replace the published tree wholesale so deleted assets do not linger.
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -R dist/. "$WORKTREE"/

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "deploy: gh-pages already matches the build at $SOURCE_SHA -- nothing to publish."
  exit 0
fi

git -C "$WORKTREE" commit -q -m "Deploy $SOURCE_SHA to Pages

Built output of $SOURCE_BRANCH at $SOURCE_SHA (vite build, base=/IKUSEI/).
This branch is generated; edit the source on main, never here."

git -C "$WORKTREE" push origin gh-pages
echo "deploy: published $SOURCE_SHA -> https://ochakuu8-sudo.github.io/IKUSEI/"
