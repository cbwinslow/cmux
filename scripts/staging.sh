#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/apps/client"

ENV_FILE="$ROOT_DIR/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Expected $ENV_FILE to exist so staging uses production env vars." >&2
  exit 1
fi

echo "==> Building cmux-staging with env file: $ENV_FILE"
(cd "$CLIENT_DIR" && CMUX_APP_NAME="cmux-staging" bun run --env-file "$ENV_FILE" build:mac:workaround)
