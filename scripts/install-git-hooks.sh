#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git not found; skipping git hook installation."
  exit 0
fi

if ! repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Not inside a git work tree; skipping git hook installation."
  exit 0
fi

cd "$repo_root"
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/pre-push scripts/install-git-hooks.sh scripts/secret_guard.py
echo "Configured core.hooksPath to .githooks"
