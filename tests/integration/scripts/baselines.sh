#!/usr/bin/env bash
# `pnpm test:baselines`: (re)generates the committed Linux screenshot baselines in CI's image
# (the screenshot ADR). Only the reference target (vue) writes; every other target must match.
#   bash scripts/baselines.sh update   UF_UPDATE=1 browser:vue run; copies back *-linux.png and geometry,
#                                      and fails where a DOM, ARIA or trace expectation reads otherwise on Linux
#   bash scripts/baselines.sh check    CI's compare mode (CI=1) for the browser projects: nothing is written
# UF_BASELINE_PLATFORM=linux/arm64 runs natively on Apple silicon, for `check` only: GitHub's
# ubuntu runners are x64, so the committed baselines come from linux/amd64, and the write
# policy refuses any other environment (UF_BASELINE_ENVIRONMENT, set in the container).
#
# The container installs the dependencies (with their install scripts) and runs the tests, so it
# gets no writable path on the host: the repository is mounted read-only. In update mode it
# leaves the baselines that changed in its own /out, which this script takes with `docker cp`
# once the container has stopped. Only regular files at a baseline's path go into the
# repository; anything else there (a symlink, a git hook, a manifest) refuses the whole copy.
set -euo pipefail
# The path filter below is a gate: its ranges ([a-z0-9]) must mean ASCII whatever the host's
# locale collates between a and z.
export LC_ALL=C
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODE="${1:-update}"
shift || true
PLATFORM="${UF_BASELINE_PLATFORM:-linux/amd64}"
# Keep in lockstep with the playwright catalog version (1.63.0 ↔ chromium-1243): the image ships
# the browsers. CI's browser jobs run in the same image.
IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble"
STORE_VOLUME="uf-pnpm-store-${PLATFORM//\//-}"
# A case's area and name and a scenario are kebab-case: KEBAB_CASE in @unframework/testing/node,
# which harness/cases.ts, expectParity and the visual command check. This must accept exactly
# the names it accepts (harness/baselines.unit.test.ts), or one name would hold back every baseline.
KEBAB='[a-z0-9]+(-[a-z0-9]+)*'
BASELINE_PATH="^tests/integration/cases/$KEBAB/$KEBAB/(__screenshots__/$KEBAB-chromium-linux\.png|__expected__/geometry\.$KEBAB\.json)\$"

case "$MODE" in
  update | check) ;;
  *)
    echo "unknown mode: $MODE (expected update or check)" >&2
    exit 2
    ;;
esac
if [ "$MODE" = update ] && [ "$PLATFORM" != linux/amd64 ]; then
  echo "test:baselines update writes the committed baselines, which come from linux/amd64 (CI's runners), not $PLATFORM. Run \`bash scripts/baselines.sh check\` to compare on $PLATFORM." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "test:baselines needs Docker: the baselines come from ${IMAGE} on ${PLATFORM}." >&2
  exit 1
fi

run=(
  docker run --init --ipc=host --platform "$PLATFORM"
  -v "$REPO:/repo:ro"
  -v "$STORE_VOLUME:/pnpm-store"
  -e "UF_BASELINE_IMAGE=$IMAGE"
  -e "UF_TARGETS=${UF_TARGETS:-}"
)
if [ "$MODE" = check ]; then
  exec "${run[@]}" --rm "$IMAGE" bash /repo/tests/integration/scripts/baselines-in-container.sh check "$@"
fi

CONTAINER="uf-baselines-$$-$RANDOM"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/uf-baselines.XXXXXX")"
cleanup() {
  docker rm --force "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf -- "$OUT"
}
trap cleanup EXIT
status=0
"${run[@]}" --name "$CONTAINER" \
  "$IMAGE" bash /repo/tests/integration/scripts/baselines-in-container.sh update "$@" || status=$?
# A failing follower does not invalidate what the reference wrote: copy back either way.
if ! docker cp "$CONTAINER:/out/." "$OUT"; then
  echo "test:baselines: could not take the baselines out of the container (/out)." >&2
  exit $((status ? status : 1))
fi

baselines=()
refused=()
while IFS= read -r -d '' entry; do
  path="${entry#"$OUT"/}"
  if [ -f "$entry" ] && [ ! -L "$entry" ] && [[ $path =~ $BASELINE_PATH ]]; then
    baselines+=("$path")
  else
    refused+=("$path")
  fi
done < <(find "$OUT" -mindepth 1 ! -type d -print0)
if [ "${#refused[@]}" -gt 0 ]; then
  echo "test:baselines: the container left something other than baselines (regular files at cases/<area>/<case>/__screenshots__/<scenario>-chromium-linux.png or __expected__/geometry.<scenario>.json, every name kebab-case); nothing was copied:" >&2
  printf '  %s\n' "${refused[@]}" >&2
  exit 1
fi
for path in ${baselines[@]+"${baselines[@]}"}; do
  mkdir -p -- "$(dirname -- "$REPO/$path")"
  # Never write through whatever is at the destination (a symlink would redirect the copy).
  rm -f -- "$REPO/$path"
  cp -- "$OUT/$path" "$REPO/$path"
  echo "baseline: $path"
done
exit "$status"
