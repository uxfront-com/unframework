#!/usr/bin/env bash
# Runs inside mcr.microsoft.com/playwright:v1.63.0-noble (see baselines.sh). The repository is
# mounted read-only at /repo and never installed into: the host's node_modules hold the host's
# native bindings (rolldown, lightningcss, esbuild), which cannot run here. So the sources are
# copied to /work and installed there against a persistent pnpm store volume; in update mode the
# baselines that changed are copied to the container's own /out, which baselines.sh takes with
# `docker cp` and filters before anything reaches the repository.
# CI's Baselines job already runs in the image, so `baselines.sh ci` calls this script directly
# and points the four directories at the job's checkout and its own scratch (ADR-0062).
set -euo pipefail
MODE="${1:-update}"
shift || true
REPO="${UF_BASELINE_REPO:-/repo}"
WORK="${UF_BASELINE_WORK:-/work}"
OUT="${UF_BASELINE_OUT:-/out}"
STORE="${UF_BASELINE_STORE:-/pnpm-store}"

if [ -z "${UF_BASELINE_IMAGE:-}" ]; then
  echo "UF_BASELINE_IMAGE is not set: run this through scripts/baselines.sh." >&2
  exit 1
fi
# What the visual write policy checks before it writes a committed PNG or geometry file
# (@unframework/testing/node): the image and the platform this container really runs on.
UF_BASELINE_ENVIRONMENT="$UF_BASELINE_IMAGE linux/$(dpkg --print-architecture)"
export UF_BASELINE_ENVIRONMENT

mkdir -p "$WORK" "$OUT"
tar -C "$REPO" \
  --exclude=node_modules --exclude=.git --exclude=.turbo --exclude=.nuxt --exclude=.output \
  --exclude=.reports --exclude=.canary --exclude=.live --exclude=.vitest --exclude=.uf-tmp \
  --exclude=packages/compiler-v1 \
  -cf - . | tar -C "$WORK" -xf -
cd "$WORK"

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable pnpm
pnpm --version
# The harness, its workspace dependencies and the target toolchains (Analog and TypeScript 6
# for Angular's browser project); not the docs site.
pnpm install --frozen-lockfile --store-dir "$STORE" --reporter=append-only \
  --filter "@unframework/integration..." --filter "./tests/toolchains/*" >/tmp/install.log 2>&1 \
  || { cat /tmp/install.log; exit 1; }

cd "$WORK/tests/integration"
# One test file at a time: on Apple silicon the container emulates linux/amd64, and a Chromium
# page per worker exhausts Docker Desktop's default 8 GB mid-run ("The chromium page crashed").
# A caller's own `--maxWorkers` replaces it: Vitest refuses the option twice.
WORKERS=(--maxWorkers=1)
for arg in "$@"; do
  case "$arg" in --maxWorkers | --maxWorkers=*) WORKERS=() ;; esac
done
case "$MODE" in
  update)
    # Only browser:vue writes the baselines; the other browser projects compare against them
    # in `check` mode and in CI, so running them here would only take time (ADR-0050).
    status=0
    env -u CI UF_UPDATE=1 UF_PIXELS=baseline node scripts/run.ts --project "browser:vue" \
      "${WORKERS[@]}" "$@" \
      || status=$?
    # A case that names its own reference (ADR-0057) takes its baselines from that target's
    # browser project, kept to its cases by UF_REFERENCE_PASS, with the caller's arguments for
    # Vitest to apply (`referencePasses` in harness/references.ts).
    env -u CI UF_UPDATE=1 UF_PIXELS=baseline node scripts/references.ts "${WORKERS[@]}" "$@" \
      || status=$?
    cd "$WORK"
    # Only what changed, so an unchanged baseline keeps its bytes and its mtime on the host.
    find tests/integration/cases -type f \
      \( -path '*/__screenshots__/*-chromium-linux.png' -o -path '*/__expected__/geometry.*.json' \) \
      -print0 |
      while IFS= read -r -d '' file; do
        if cmp -s -- "$file" "$REPO/$file"; then continue; fi
        mkdir -p -- "$OUT/$(dirname -- "$file")"
        cp -- "$file" "$OUT/$file"
      done
    # The reference rewrote the platform-independent expectations here too: the DOM, the ARIA
    # tree, the traces (and the server HTML) must read the same on Linux as where
    # `pnpm test:update` wrote them, or CI would fail where no local command does (a DOM read
    # of geometry fed into state, say).
    platform=()
    while IFS= read -r -d '' file; do
      if [ ! -f "$file" ] || [ ! -f "$REPO/$file" ] || ! cmp -s -- "$file" "$REPO/$file"; then
        platform+=("$file")
      fi
    done < <(
      for root in . "$REPO"; do
        (cd "$root" && find tests/integration/cases -type f -path '*/__expected__/*' \
          \( -name 'dom.*' -o -name 'aria.*' -o -name 'trace.*' -o -name 'ssr.*' \) -print0)
      done | sort -zu
    )
    if [ "${#platform[@]}" -gt 0 ]; then
      echo "test:baselines: these expectations read differently on Linux than in the repository; they depend on the platform (a layout read feeding state or an emit, say) and must not:" >&2
      printf '  %s\n' "${platform[@]}" >&2
      status=1
    fi
    exit "$status"
    ;;
  check)
    # CI's mode (baseline pixels, nothing written) for the browser projects only: the summary
    # judges the projects the run selected, as a partial run.
    CI=1 node scripts/run.ts --project "browser:*" "${WORKERS[@]}" "$@"
    ;;
  *)
    echo "unknown mode: $MODE (expected update or check)" >&2
    exit 2
    ;;
esac
