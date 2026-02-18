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


if git rev-parse "$TAG" >/dev/null 2>&1; then
  #
  # Delete the failed tag (remote + local)
  git tag -d $TAG
  git push origin :refs/tags/$TAG

  # Delete the failed GitHub release if one was created
  gh release delete $TAG --yes
fi


