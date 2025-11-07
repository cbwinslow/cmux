#!/usr/bin/env bash
set -euo pipefail

# Linux build for Electron app (AppImage, deb, rpm)
# Builds the app and packages for Linux distributions

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/apps/client"
DIST_DIR="$CLIENT_DIR/dist-electron"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--env-file path] [--skip-install] [--target TARGET] [--arch ARCH]

Builds cmux for Linux distributions.

Options:
  --env-file path        Source environment variables from a file before running
  --skip-install         Skip 'bun install --frozen-lockfile'
  --target TARGET        Build target: appimage, deb, rpm, or all (default: all)
  --arch ARCH           Architecture: x64, arm64, or all (default: x64)

Examples:
  $(basename "$0")                          # Build all targets for x64
  $(basename "$0") --target appimage        # Build only AppImage for x64
  $(basename "$0") --arch arm64             # Build all targets for arm64
  $(basename "$0") --target deb --arch x64  # Build deb for x64

Notes:
  - Requires bun to be installed
  - Requires Docker if building for different architectures
  - Always produces unsigned packages
EOF
}

ENV_FILE=""
SKIP_INSTALL=false
TARGET="all"
ARCH="x64"

# --- timing helpers ---
BUILD_START_TS=$(date +%s)
CURRENT_STEP_NAME=""
CURRENT_STEP_START=0
TIMINGS=()

start_step() {
  CURRENT_STEP_NAME="$1"
  CURRENT_STEP_START=$(date +%s)
  echo "==> $CURRENT_STEP_NAME"
}

end_step() {
  local end_ts
  end_ts=$(date +%s)
  local dur=$(( end_ts - CURRENT_STEP_START ))
  TIMINGS+=("$CURRENT_STEP_NAME:$dur")
  echo "-- $CURRENT_STEP_NAME took ${dur}s"
  CURRENT_STEP_NAME=""
  CURRENT_STEP_START=0
}

print_timings() {
  if (( ${#TIMINGS[@]} > 0 )); then
    echo "==> Step timing summary"
    for entry in "${TIMINGS[@]}"; do
      local name=${entry%%:*}
      local dur=${entry##*:}
      printf "  - %-32s %6ss\n" "$name" "$dur"
    done
    local total=$(( $(date +%s) - BUILD_START_TS ))
    printf "  - %-32s %6ss\n" "Total" "$total"
  fi
}

on_exit() {
  local ec=$?
  # If a step was in progress and failed before end_step, capture partial duration
  if [[ -n "$CURRENT_STEP_NAME" && $CURRENT_STEP_START -gt 0 ]]; then
    local now_ts=$(date +%s)
    local dur=$(( now_ts - CURRENT_STEP_START ))
    TIMINGS+=("$CURRENT_STEP_NAME:$dur")
  fi
  if [[ $ec -ne 0 ]]; then
    echo "!! Build failed with exit code $ec"
  fi
  print_timings
}

trap on_exit EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      if [[ -z "$ENV_FILE" ]]; then
        echo "--env-file requires a path" >&2
        exit 1
      fi
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --target)
      TARGET="${2:-}"
      if [[ -z "$TARGET" ]]; then
        echo "--target requires a value (appimage, deb, rpm, or all)" >&2
        exit 1
      fi
      shift 2
      ;;
    --arch)
      ARCH="${2:-}"
      if [[ -z "$ARCH" ]]; then
        echo "--arch requires a value (x64, arm64, or all)" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Validate target
case "$TARGET" in
  all|appimage|deb|rpm)
    ;;
  *)
    echo "Invalid target: $TARGET (must be appimage, deb, rpm, or all)" >&2
    exit 1
    ;;
esac

# Validate arch
case "$ARCH" in
  x64|arm64|all)
    ;;
  *)
    echo "Invalid architecture: $ARCH (must be x64, arm64, or all)" >&2
    exit 1
    ;;
esac

command -v bun >/dev/null 2>&1 || { echo "bun is required. Install from https://bun.sh" >&2; exit 1; }

start_step "Load environment"
if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  # Default to repo root production env if present
  if [[ -f "$ROOT_DIR/.env.production" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env.production"
    set +a
  fi
fi
end_step

start_step "Generate icons"
(cd "$CLIENT_DIR" && bun run ./scripts/generate-icons.mjs)
end_step

if [[ "$SKIP_INSTALL" != "true" ]]; then
  start_step "Install dependencies"
  (cd "$ROOT_DIR" && bun install --frozen-lockfile)
  end_step
fi

start_step "Build native addon (release)"
# Use architecture-specific targets for cross-compilation
if [[ "$ARCH" == "arm64" ]]; then
  (cd "$ROOT_DIR/apps/server/native/core" && bunx --bun @napi-rs/cli build --target aarch64-unknown-linux-gnu --release)
elif [[ "$ARCH" == "x64" ]]; then
  (cd "$ROOT_DIR/apps/server/native/core" && bunx --bun @napi-rs/cli build --target x86_64-unknown-linux-gnu --release)
else
  # For 'all', build natively for the host platform (each arch will be built in separate jobs)
  (cd "$ROOT_DIR/apps/server/native/core" && bunx --bun @napi-rs/cli build --platform --release)
fi
end_step

start_step "Build Electron app"
(cd "$CLIENT_DIR" && bunx electron-vite build -c electron.vite.config.ts)
end_step

mkdir -p "$DIST_DIR"

# Build based on target and architecture
build_for_target_arch() {
  local target_type=$1
  local arch_type=$2
  
  start_step "Package $target_type for $arch_type"
  (cd "$CLIENT_DIR" && \
    bunx electron-builder \
      --config electron-builder.json \
      --linux "$target_type" "--$arch_type" \
      --publish never)
  end_step
}

# Build for specified target(s) and architecture(s)
if [[ "$TARGET" == "all" ]]; then
  TARGETS=(appimage deb rpm)
else
  TARGETS=("$TARGET")
fi

if [[ "$ARCH" == "all" ]]; then
  ARCHES=(x64 arm64)
else
  ARCHES=("$ARCH")
fi

for target in "${TARGETS[@]}"; do
  for arch in "${ARCHES[@]}"; do
    build_for_target_arch "$target" "$arch"
  done
done

echo "==> Done. Outputs in: $DIST_DIR"
ls -lh "$DIST_DIR"
