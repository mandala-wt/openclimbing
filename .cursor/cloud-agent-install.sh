#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")/.."

if ! command -v yarn >/dev/null 2>&1; then
  echo "yarn is not on PATH" >&2
  exit 1
fi

yarn install --frozen-lockfile --network-timeout 600000
