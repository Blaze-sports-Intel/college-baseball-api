#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

patterns=(
  "sk-[A-Za-z0-9]{20,}"
  "ghp_[A-Za-z0-9]{36}"
  "AKIA[0-9A-Z]{16}"
  "(?i)(api[_-]?key|secret|token)\\s*[:=]\\s*['\"][A-Za-z0-9_\\-]{12,}"
  "(?i)authorization\\s*[:=]\\s*['\"]Bearer\\s+[A-Za-z0-9_\\-.]{12,}"
)

exclude_globs=("--glob" "!.git/**" "--glob" "!node_modules/**" "--glob" "!package-lock.json")

failed=0
for pattern in "${patterns[@]}"; do
  if rg -l -P "${pattern}" . "${exclude_globs[@]}" > /dev/null; then
    echo "Potential secret pattern found for regex: ${pattern}"
    rg -l -P "${pattern}" . "${exclude_globs[@]}"
    failed=1
  fi
done

build_dirs=(.next out build public)
for dir in "${build_dirs[@]}"; do
  if [[ -d "$dir" ]]; then
    if rg -l -P "sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}" "$dir" > /dev/null; then
      echo "Potential secret token found in build output directory: $dir"
      rg -l -P "sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}" "$dir"
      failed=1
    fi
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "Secret smoke check failed."
  exit 1
fi

echo "Secret smoke check passed."
