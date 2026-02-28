#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  current=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
  echo "Current version: $current"
  echo "Usage: scripts/release.sh <version>"
  echo "Example: scripts/release.sh 0.2.0"
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be semver (e.g. 0.2.0), got: $VERSION"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is dirty. Commit or stash changes first."
  exit 1
fi

if grep -q 'artifactory\|npm\.corp' pnpm-lock.yaml 2>/dev/null; then
  echo "Error: pnpm-lock.yaml contains corporate registry URLs."
  echo "Run: rm pnpm-lock.yaml && pnpm install"
  exit 1
fi

TAG="v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Tag $TAG already exists"
  exit 1
fi

CONF="src-tauri/tauri.conf.json"
CARGO="src-tauri/Cargo.toml"
LOCK="src-tauri/Cargo.lock"

sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$CONF"
sed -i '' '/^\[package\]/,/^version = /{s/^version = ".*"/version = "'"$VERSION"'"/;}' "$CARGO"
(cd src-tauri && cargo update -p otterly)

echo "Updated $CONF, $CARGO and $LOCK to $VERSION"

git add "$CONF" "$CARGO" "$LOCK"
git commit -m "Bump version to $VERSION"
git tag -a "$TAG" -m "$TAG"
git push origin HEAD --follow-tags

echo "Pushed $TAG — GitHub Actions will handle the release build."
