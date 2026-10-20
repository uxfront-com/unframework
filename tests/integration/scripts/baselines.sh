#!/usr/bin/env bash
# `pnpm test:baselines`: (re)generates the committed Linux screenshot baselines in CI's image
# (the screenshot ADR). Only the reference target (vue) writes, and the target a case names as its
# own reference (ADR-0057) for that case; every other target must match.
#   bash scripts/baselines.sh update   UF_UPDATE=1 browser:vue run; copies back *-linux.png and geometry,
#                                      and fails where a DOM, ARIA or trace expectation reads otherwise on Linux
#   bash scripts/baselines.sh check    CI's compare mode (CI=1) for the browser projects: nothing is written
#   bash scripts/baselines.sh ci       CI's Baselines job, already in the image: update's run, with the
#                                      baselines that changed left in $UF_BASELINE_ARTEFACT for upload
#   bash scripts/baselines.sh download [<run-id>]
#                                      `pnpm test:baselines:download`: copies a CI run's `baselines`
#                                      artefact into the cases (by default the current branch's latest run)
# UF_BASELINE_PLATFORM=linux/arm64 runs natively on Apple silicon, for `check` only: GitHub's
# ubuntu runners are x64, so the committed baselines come from linux/amd64, and the write
# policy refuses any other environment (UF_BASELINE_ENVIRONMENT, set in the container).
#
# The container installs the dependencies (with their install scripts) and runs the tests, so it
# gets no writable path on the host: the repository is mounted read-only. In update mode it
# leaves the baselines that changed in its own /out, which this script takes with `docker cp`
# once the container has stopped. Only regular files at a baseline's path go into the
# repository; anything else there (a symlink, a git hook, a manifest) refuses the whole copy.
# The same filter guards what CI uploads and what `download` copies in (ADR-0062).
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
  update | check | ci | download) ;;
  *)
    echo "unknown mode: $MODE (expected update, check, ci or download)" >&2
    exit 2
    ;;
esac

# copy_baselines <from> <to> <source>: copies every baseline under <from> to the same path under
# <to>, or nothing at all when <from> holds anything else.
copy_baselines() {
  local from="$1" to="$2" source="$3" entry path
  local baselines=() refused=()
  while IFS= read -r -d '' entry; do
    path="${entry#"$from"/}"
    if [ -f "$entry" ] && [ ! -L "$entry" ] && [[ $path =~ $BASELINE_PATH ]]; then
      baselines+=("$path")
    else
      refused+=("$path")
    fi
  done < <(find "$from" -mindepth 1 ! -type d -print0)
  if [ "${#refused[@]}" -gt 0 ]; then
    echo "test:baselines: $source left something other than baselines (regular files at cases/<area>/<case>/__screenshots__/<scenario>-chromium-linux.png or __expected__/geometry.<scenario>.json, every name kebab-case); nothing was copied:" >&2
    printf '  %s\n' "${refused[@]}" >&2
    return 1
  fi
  for path in ${baselines[@]+"${baselines[@]}"}; do
    mkdir -p -- "$(dirname -- "$to/$path")"
    # Never write through whatever is at the destination (a symlink would redirect the copy).
    rm -f -- "$to/$path"
    cp -- "$from/$path" "$to/$path"
    echo "baseline: $path"
  done
}

if [ "$MODE" = download ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "test:baselines:download needs the GitHub CLI (gh), signed in to the repository." >&2
    exit 1
  fi
  run="${1:-}"
  if [ -z "$run" ]; then
    if ! branch="$(git -C "$REPO" symbolic-ref --quiet --short HEAD)"; then
      echo "test:baselines:download: HEAD is detached, so there is no branch to take the latest run of. Name the run: pnpm test:baselines:download <run-id>." >&2
      exit 1
    fi
    run="$(cd "$REPO" && gh run list --branch "$branch" --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
    if [ -z "$run" ]; then
      echo "test:baselines:download: CI has no run on $branch." >&2
      exit 1
    fi
  fi
  if ! [[ $run =~ ^[0-9]+$ ]]; then
    echo "test:baselines:download: a run id is a number, not $run." >&2
    exit 2
  fi
  info="$(cd "$REPO" && gh run view "$run" --json status,headSha,jobs \
    --jq '[.status, .headSha, ([.jobs[] | select(.name == "Baselines")][0].conclusion // "none")] | @tsv')"
  IFS=$'\t' read -r state head job <<<"$info"
  if [ "$state" != completed ]; then
    echo "test:baselines:download: run $run is $state; wait until it completes." >&2
    exit 1
  fi
  echo "test:baselines:download: run $run, of $head; its Baselines job: $job."
  if [ "$head" != "$(git -C "$REPO" rev-parse HEAD 2>/dev/null)" ]; then
    echo "test:baselines:download: run $run is of $head, not of HEAD; its baselines are that commit's." >&2
  fi
  artefacts="$(cd "$REPO" && gh api "repos/{owner}/{repo}/actions/runs/$run/artifacts" \
    --jq '[.artifacts[] | select(.name == "baselines")] | length')"
  if [ "$artefacts" = 0 ]; then
    # The job uploads nothing when no baseline changed.
    if [ "$job" = success ]; then
      echo "test:baselines:download: run $run changed no baseline; nothing was written."
      exit 0
    fi
    echo "test:baselines:download: run $run has no baselines artefact, and its Baselines job is $job." >&2
    exit 1
  fi
  DOWNLOAD="$(mktemp -d "${TMPDIR:-/tmp}/uf-baselines.XXXXXX")"
  trap 'rm -rf -- "$DOWNLOAD"' EXIT
  (cd "$REPO" && gh run download "$run" --name baselines --dir "$DOWNLOAD")
  copy_baselines "$DOWNLOAD" "$REPO" "the artefact"
  if [ "$job" != success ]; then
    # As `update` does, a failing run still gives what its reference wrote, and fails.
    echo "test:baselines:download: run $run's Baselines job is $job; read its log before you commit these." >&2
    exit 1
  fi
  exit 0
fi

if [ "$MODE" = ci ]; then
  # GitHub's ubuntu runners are linux/amd64 and the job runs in $IMAGE, so the container script
  # runs here as it would under `docker run`, on the job's checkout and its own scratch.
  if [ "${GITHUB_ACTIONS:-}" != true ] || [ -z "${UF_BASELINE_ARTEFACT:-}" ]; then
    echo "test:baselines ci runs only in CI's Baselines job, which sets UF_BASELINE_ARTEFACT. Locally, run \`pnpm test:baselines\`." >&2
    exit 1
  fi
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/uf-baselines.XXXXXX")"
  trap 'rm -rf -- "$SCRATCH"' EXIT
  mkdir -p -- "$UF_BASELINE_ARTEFACT"
  status=0
  UF_BASELINE_IMAGE="$IMAGE" UF_BASELINE_REPO="$REPO" UF_BASELINE_WORK="$SCRATCH/work" \
    UF_BASELINE_OUT="$SCRATCH/out" UF_BASELINE_STORE="$SCRATCH/store" \
    bash "$REPO/tests/integration/scripts/baselines-in-container.sh" update "$@" || status=$?
  # A failing follower does not invalidate what the reference wrote: upload it either way.
  copy_baselines "$SCRATCH/out" "$UF_BASELINE_ARTEFACT" "the run"
  exit "$status"
fi

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
copy_baselines "$OUT" "$REPO" "the container"
exit "$status"
