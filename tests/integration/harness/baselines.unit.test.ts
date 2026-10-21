// `pnpm test:baselines` on the host: scripts/baselines.sh, run from a copy of the repository
// layout with a stand-in `docker` that records how it was called and plays the container: in
// update mode, each test decides what the container leaves in its /out. The container half
// needs the Playwright image; here it is only parsed, and CI's `ci` mode runs a stand-in for it.
// `pnpm test:baselines:download` runs against a stand-in `gh` that plays one CI run (ADR-0062).
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BASELINE_ENVIRONMENT, KEBAB_CASE } from "@unframework/testing/node";
import { afterEach, describe, expect, it } from "vitest";

import { REPO_ROOT, ROOT } from "./paths.ts";

const SCRIPTS = join(ROOT, "scripts");
const BASELINE = "tests/integration/cases/area/my-case/__screenshots__/initial-chromium-linux.png";
const GEOMETRY = "tests/integration/cases/area/my-case/__expected__/geometry.initial.json";

// Records each call (its arguments, then `--end--`). `run --name <c>` plays container <c>:
// FAKE_CONTAINER_WRITES runs with `$out` set to its /out. `cp <c>:/out/. <dir>` copies that out
// as `docker cp` does (symlinks stay symlinks), and `rm` removes the container.
const FAKE_DOCKER = `#!/usr/bin/env bash
{ printf '%s\\n' "$@"; echo --end--; } >>"$FAKE_DOCKER_LOG"
case "$1" in
  run)
    name=""
    previous=""
    for argument in "$@"; do
      if [ "$previous" = --name ]; then name="$argument"; fi
      previous="$argument"
    done
    if [ -n "$name" ]; then
      out="$FAKE_DOCKER_CONTAINERS/$name/out"
      mkdir -p "$out"
      eval "$FAKE_CONTAINER_WRITES"
    fi
    exit "\${FAKE_DOCKER_STATUS:-0}"
    ;;
  cp)
    container="$FAKE_DOCKER_CONTAINERS/\${2%%:*}"
    [ -d "$container/out" ] || exit 1
    cp -R "$container/out/." "$3"
    ;;
  rm)
    for container; do :; done
    rm -rf "$FAKE_DOCKER_CONTAINERS/$container"
    ;;
esac
`;

// Records each call as the stand-in docker does, and answers as gh does: `run list` with
// FAKE_GH_RUNS, `run view` with FAKE_GH_RUN, `api` with FAKE_GH_NAMED for a `?name=baselines`
// query and FAKE_GH_PAGE, the first page of the unfiltered list, for any other. Each answer is
// JSON, and the call's --jq filter runs on it with jq, as gh's own does. `run download` copies
// the artefact (FAKE_GH_STAGE) into its --dir.
const FAKE_GH = `#!/usr/bin/env bash
{ printf '%s\\n' "$@"; echo --end--; } >>"$FAKE_GH_LOG"
filter=""
dir=""
previous=""
for argument in "$@"; do
  case "$previous" in
    --jq) filter="$argument" ;;
    --dir) dir="$argument" ;;
  esac
  previous="$argument"
done
case "$1 $2" in
  "run list") response="$FAKE_GH_RUNS" ;;
  "run view") response="$FAKE_GH_RUN" ;;
  "api "*"?name=baselines") response="$FAKE_GH_NAMED" ;;
  "api "*) response="$FAKE_GH_PAGE" ;;
  "run download")
    cp -R "$FAKE_GH_STAGE/." "$dir"
    exit 0
    ;;
  *)
    echo "the stand-in gh has no answer to: $*" >&2
    exit 1
    ;;
esac
if [ -z "$filter" ]; then
  printf '%s\\n' "$response"
  exit 0
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "the stand-in gh runs --jq filters with jq, which is not on PATH" >&2
  exit 127
fi
printf '%s' "$response" | jq -r "$filter"
`;

/** A run as `gh run view --json headSha,jobs` gives it, with another job before its Baselines job. */
function ghRun({
  head = "abc123",
  status = "completed",
  conclusion = "success",
  baselines = true,
}: { head?: string; status?: string; conclusion?: string; baselines?: boolean } = {}): string {
  const jobs = [
    { name: "Unit tests", status: "completed", conclusion: "failure" },
    ...(baselines ? [{ name: "Baselines", status, conclusion }] : []),
  ];
  return JSON.stringify({ headSha: head, jobs });
}

/** A page of a run's artefacts, as `GET /actions/runs/<id>/artifacts` gives it. */
function artefacts(names: readonly string[], total = names.length): string {
  return JSON.stringify({ total_count: total, artifacts: names.map((name) => ({ name })) });
}

/**
 * The first page of a run with 31 artefacts: 30 per page, and `baselines` on the second, as a
 * run whose baselines changed can have (every browser job uploads its visual diffs).
 */
const FIRST_PAGE = artefacts(
  Array.from({ length: 30 }, (_, index) => `parity-${index}`),
  31,
);

/** Makes `repo` a git repository with one commit on `probe`, detached if asked; returns HEAD. */
function commit(repo: string, { detach = false } = {}): string {
  const git = (...args: string[]) =>
    spawnSync(
      "git",
      [
        "-C",
        repo,
        "-c",
        "user.name=probe",
        "-c",
        "user.email=probe@example.com",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      { encoding: "utf8" },
    );
  git("init", "--quiet", "--initial-branch", "probe");
  git("commit", "--quiet", "--allow-empty", "--message", "probe");
  if (detach) git("switch", "--quiet", "--detach");
  return git("rev-parse", "HEAD").stdout.trim();
}

// Stands in for baselines-in-container.sh in `ci` mode: records its arguments and the
// directories it was given, then writes FAKE_CONTAINER_WRITES with `$out` set to its OUT.
const FAKE_CONTAINER = `#!/usr/bin/env bash
{ printf '%s\\n' "$@"; env | grep '^UF_BASELINE_' | sort; } >"$FAKE_CONTAINER_LOG"
out="$UF_BASELINE_OUT"
mkdir -p "$out"
eval "$FAKE_CONTAINER_WRITES"
exit "\${FAKE_DOCKER_STATUS:-0}"
`;

/** What the container leaves in /out by default: one changed baseline. */
const WRITES_BASELINE = `mkdir -p "$out/$(dirname "${BASELINE}")" && printf png >"$out/${BASELINE}"`;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function run(
  args: string[],
  env: Record<string, string> = {},
  prepare?: (root: string, repo: string) => Record<string, string> | void,
) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "uf-baselines-")));
  roots.push(root);
  const repo = join(root, "repo");
  const scripts = join(repo, "tests", "integration", "scripts");
  mkdirSync(scripts, { recursive: true });
  for (const script of ["baselines.sh", "baselines-in-container.sh"]) {
    copyFileSync(join(SCRIPTS, script), join(scripts, script));
  }
  mkdirSync(join(repo, ".git", "hooks"), { recursive: true });
  writeFileSync(join(repo, "package.json"), '{ "name": "repo" }\n');
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  chmodSync(join(bin, "docker"), 0o755);
  writeFileSync(join(bin, "gh"), FAKE_GH);
  chmodSync(join(bin, "gh"), 0o755);
  const temp = join(root, "tmp");
  mkdirSync(temp);
  const log = join(root, "docker.log");
  const ghLog = join(root, "gh.log");
  const prepared = prepare?.(root, repo) || {};
  const result = spawnSync("bash", [join(scripts, "baselines.sh"), ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      TMPDIR: temp,
      FAKE_DOCKER_LOG: log,
      FAKE_DOCKER_CONTAINERS: join(root, "containers"),
      FAKE_CONTAINER_WRITES: WRITES_BASELINE,
      FAKE_CONTAINER_LOG: join(root, "container.log"),
      FAKE_GH_LOG: ghLog,
      FAKE_GH_RUNS: "[]",
      FAKE_GH_RUN: ghRun(),
      FAKE_GH_NAMED: artefacts(["baselines"]),
      FAKE_GH_PAGE: FIRST_PAGE,
      FAKE_GH_STAGE: join(root, "stage"),
      UF_BASELINE_PLATFORM: "",
      GITHUB_ACTIONS: "",
      UF_BASELINE_ARTEFACT: "",
      ...env,
      ...prepared,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    calls: callsIn(log),
    gh: callsIn(ghLog),
    root,
    repo,
    temp,
  };
}

/** The calls a stand-in recorded, each its list of arguments. */
function callsIn(log: string): string[][] {
  return existsSync(log)
    ? readFileSync(log, "utf8")
        .split("--end--\n")
        .filter(Boolean)
        .map((call) => call.trimEnd().split("\n"))
    : [];
}

/** Writes each of `files` under `<root>/stage`, where a stand-in takes them from. */
function stage(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, "stage", path)), { recursive: true });
    writeFileSync(join(root, "stage", path), content);
  }
}

/** Runs `update` with a container that leaves exactly `staged` in its /out. */
function updateWith(staged: readonly string[]) {
  return run(
    ["update"],
    { FAKE_CONTAINER_WRITES: 'cp -R "$FAKE_DOCKER_CONTAINERS/../stage/." "$out"' },
    (root) => stage(root, Object.fromEntries(staged.map((path) => [path, "baseline"]))),
  );
}

/** The value after each `flag` in an argument list. */
const valuesOf = (args: readonly string[], flag: string) =>
  args.flatMap((argument, index) => (args[index - 1] === flag ? [argument] : []));

describe("baselines.sh update", () => {
  it("runs the container with no writable host path, and copies the baselines out of it", () => {
    const { status, calls, repo, root, temp, stdout } = run(["update"]);
    expect(status).toBe(0);
    const [docker, copy, remove] = calls;
    expect(docker![0]).toBe("run");
    expect(valuesOf(docker!, "-v")).toEqual([
      `${repo}:/repo:ro`,
      expect.stringMatching(/^uf-pnpm-store-linux-amd64:\/pnpm-store$/),
    ]);
    expect(valuesOf(docker!, "-e")).toContain(
      `UF_BASELINE_IMAGE=${BASELINE_ENVIRONMENT.split(" ")[0]}`,
    );
    expect(docker!.slice(-2)).toEqual([
      "/repo/tests/integration/scripts/baselines-in-container.sh",
      "update",
    ]);
    const [container] = valuesOf(docker!, "--name");
    expect(copy).toEqual(["cp", `${container}:/out/.`, expect.stringMatching(/uf-baselines\./)]);
    expect(remove).toEqual(["rm", "--force", container]);
    expect(readFileSync(join(repo, BASELINE), "utf8")).toBe("png");
    expect(stdout).toContain(`baseline: ${BASELINE}`);
    // The container and the copy are gone.
    expect(readdirSync(temp)).toEqual([]);
    expect(existsSync(join(root, "containers", container!))).toBe(false);
  });

  it("copies the baselines back when a follower failed, and fails with the run", () => {
    const { status, repo } = run(["update"], { FAKE_DOCKER_STATUS: "3" });
    expect(status).toBe(3);
    expect(existsSync(join(repo, BASELINE))).toBe(true);
  });

  it("copies nothing when the container left anything but baselines", () => {
    const writes = [
      WRITES_BASELINE,
      'mkdir -p "$out/.git/hooks" && echo "echo pwned" >"$out/.git/hooks/pre-commit"',
      `echo '{ "name": "replaced" }' >"$out/package.json"`,
      // A symlink at a baseline's own path, and a case directory that is a symlink.
      `mkdir -p "$out/${dirname(GEOMETRY)}" && ln -s /etc/hosts "$out/${GEOMETRY}"`,
      'mkdir -p "$out/tests/integration/cases/area" && ln -s /etc "$out/tests/integration/cases/area/linked"',
    ].join(" && ");
    const { status, stderr, repo } = run(["update"], { FAKE_CONTAINER_WRITES: writes });
    expect(status).toBe(1);
    expect(stderr).toContain(
      "left something other than baselines (regular files at cases/<area>/<case>/__screenshots__/<scenario>-chromium-linux.png or __expected__/geometry.<scenario>.json, every name kebab-case); nothing was copied:\n",
    );
    for (const refused of [
      ".git/hooks/pre-commit",
      "package.json",
      GEOMETRY,
      "tests/integration/cases/area/linked",
    ]) {
      expect(stderr).toContain(`  ${refused}\n`);
    }
    expect(existsSync(join(repo, ".git", "hooks", "pre-commit"))).toBe(false);
    expect(readFileSync(join(repo, "package.json"), "utf8")).toBe('{ "name": "repo" }\n');
    expect(existsSync(join(repo, BASELINE))).toBe(false);
    expect(existsSync(join(repo, GEOMETRY))).toBe(false);
  });

  it("refuses a file outside a case's baselines, even with a baseline's name", () => {
    const outside = "tests/integration/cases/area/my-case/initial-chromium-linux.png";
    const { status, stderr, repo } = run(["update"], {
      FAKE_CONTAINER_WRITES: `mkdir -p "$out/${dirname(outside)}" && printf png >"$out/${outside}"`,
    });
    expect(status).toBe(1);
    expect(stderr).toContain(`  ${outside}\n`);
    expect(existsSync(join(repo, outside))).toBe(false);
  });

  it("replaces a symlink at a baseline's path instead of writing through it", () => {
    let outside = "";
    const { status, repo } = run(["update"], {}, (root, planted) => {
      outside = join(root, "outside.png");
      writeFileSync(outside, "untouched");
      mkdirSync(dirname(join(planted, BASELINE)), { recursive: true });
      symlinkSync(outside, join(planted, BASELINE));
    });
    expect(status).toBe(0);
    expect(lstatSync(join(repo, BASELINE)).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(repo, BASELINE), "utf8")).toBe("png");
    expect(readFileSync(outside, "utf8")).toBe("untouched");
  });

  it("refuses to write baselines on any platform but CI's", () => {
    const { status, stderr, calls } = run(["update"], { UF_BASELINE_PLATFORM: "linux/arm64" });
    expect(status).toBe(1);
    expect(stderr).toContain("come from linux/amd64");
    expect(calls).toEqual([]);
    expect(run(["refresh"]).status).toBe(2);
  });
});

describe("the names baselines.sh copies", () => {
  // At the edges of the rule: one hyphen between words, none at either end, nothing but a-z
  // and 0-9 in a word.
  const NAMES = [
    "a",
    "1",
    "a-1",
    "initial",
    "after-click",
    "x2-y3",
    "after--click",
    "open-",
    "-open",
    "Open",
    "after_click",
    "after.click",
    "café",
    "a b",
  ];
  /** Every path at which a name is the scenario, the case or the area, staged in the container. */
  const paths = [
    ...NAMES.flatMap((name, index) => [
      {
        name,
        path: `tests/integration/cases/area/case-${index}/__screenshots__/${name}-chromium-linux.png`,
      },
      {
        name,
        path: `tests/integration/cases/area/case-${index}/__expected__/geometry.${name}.json`,
      },
      {
        name,
        path: `tests/integration/cases/area/${name}/__screenshots__/initial-chromium-linux.png`,
      },
      { name, path: `tests/integration/cases/${name}/my-case/__expected__/geometry.initial.json` },
    ]),
    // Only a scenario can be empty or hold a slash and still make a path of the right depth.
    { name: "", path: "tests/integration/cases/area/empty/__screenshots__/-chromium-linux.png" },
    { name: "", path: "tests/integration/cases/area/empty/__expected__/geometry..json" },
    {
      name: "a/b",
      path: "tests/integration/cases/area/nested/__screenshots__/a/b-chromium-linux.png",
    },
  ];
  const accepted = paths.filter(({ name }) => KEBAB_CASE.test(name)).map(({ path }) => path);
  const refused = paths.filter(({ name }) => !KEBAB_CASE.test(name)).map(({ path }) => path);

  it("are exactly the names KEBAB_CASE accepts (expectParity's, the visual command's, the corpus's)", () => {
    expect(accepted.length).toBeGreaterThan(0);
    const { status, stderr, repo } = updateWith(paths.map(({ path }) => path));
    expect(status).toBe(1);
    const listed = stderr
      .split("\n")
      .filter((line) => line.startsWith("  "))
      .map((line) => line.slice(2));
    expect(listed.toSorted()).toEqual(refused.toSorted());
    expect(existsSync(join(repo, "tests", "integration", "cases"))).toBe(false);
  });

  it("copies a baseline of every name KEBAB_CASE accepts", () => {
    const { status, stdout, repo } = updateWith(accepted);
    expect(status).toBe(0);
    for (const path of accepted) {
      expect(readFileSync(join(repo, path), "utf8")).toBe("baseline");
      expect(stdout).toContain(`baseline: ${path}\n`);
    }
  });
});

describe("baselines.sh check", () => {
  it("checks in a container that is removed, with no writable mount", () => {
    const { status, calls, repo } = run(["check", "--project", "browser:vue"]);
    expect(status).toBe(0);
    expect(calls).toHaveLength(1);
    const [docker] = calls;
    expect(docker).toContain("--rm");
    expect(valuesOf(docker!, "-v").filter((mount) => !mount.startsWith("uf-pnpm-store-"))).toEqual([
      `${repo}:/repo:ro`,
    ]);
    expect(docker!.slice(-3)).toEqual(["check", "--project", "browser:vue"]);
    expect(existsSync(join(repo, BASELINE))).toBe(false);
  });
});

/** Runs `ci` as CI's Baselines job does, with the stand-in container script. */
function runCi(env: Record<string, string> = {}, args: string[] = []) {
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "uf-baselines-artefact-")));
  roots.push(outside);
  const artefact = join(outside, "artefact");
  const result = run(
    ["ci", ...args],
    { GITHUB_ACTIONS: "true", UF_BASELINE_ARTEFACT: artefact, ...env },
    (_root, repo) =>
      writeFileSync(
        join(repo, "tests", "integration", "scripts", "baselines-in-container.sh"),
        FAKE_CONTAINER,
      ),
  );
  const log = join(result.root, "container.log");
  const container = existsSync(log) ? readFileSync(log, "utf8").trimEnd().split("\n") : [];
  return { ...result, artefact, container };
}

/** Runs `download <args>` against a run whose artefact holds `files`. */
function runDownload(
  args: string[],
  files: Record<string, string>,
  env: Record<string, string> = {},
  prepare?: (root: string, repo: string) => Record<string, string> | void,
) {
  return run(["download", ...args], env, (root, repo) => {
    mkdirSync(join(root, "stage"));
    stage(root, files);
    return prepare?.(root, repo);
  });
}

describe("baselines.sh ci", () => {
  it("runs the update in place of the container, without Docker, and leaves the baselines in the artefact", () => {
    const writes = [
      WRITES_BASELINE,
      `mkdir -p "$out/${dirname(GEOMETRY)}" && printf '{}' >"$out/${GEOMETRY}"`,
    ].join(" && ");
    const { status, calls, container, repo, temp, stdout, artefact } = runCi(
      { FAKE_CONTAINER_WRITES: writes },
      ["--maxWorkers=2"],
    );
    expect(status).toBe(0);
    expect(calls).toEqual([]);
    expect(container.slice(0, 2)).toEqual(["update", "--maxWorkers=2"]);
    expect(container).toContain(`UF_BASELINE_IMAGE=${BASELINE_ENVIRONMENT.split(" ")[0]}`);
    expect(container).toContain(`UF_BASELINE_REPO=${repo}`);
    for (const directory of ["WORK", "OUT", "STORE"]) {
      expect(container).toContainEqual(
        expect.stringMatching(new RegExp(`^UF_BASELINE_${directory}=${temp}/uf-baselines\\.`)),
      );
    }
    expect(readFileSync(join(artefact, BASELINE), "utf8")).toBe("png");
    expect(readFileSync(join(artefact, GEOMETRY), "utf8")).toBe("{}");
    expect(stdout).toContain(`baseline: ${BASELINE}`);
    // CI never writes into the checkout, and the scratch is gone.
    expect(existsSync(join(repo, BASELINE))).toBe(false);
    expect(readdirSync(temp)).toEqual([]);
  });

  it("leaves the artefact empty when no baseline changed", () => {
    const { status, artefact } = runCi({ FAKE_CONTAINER_WRITES: "true" });
    expect(status).toBe(0);
    expect(readdirSync(artefact)).toEqual([]);
  });

  it("keeps what the reference wrote when the run failed, and fails with it", () => {
    const { status, artefact } = runCi({ FAKE_DOCKER_STATUS: "3" });
    expect(status).toBe(3);
    expect(existsSync(join(artefact, BASELINE))).toBe(true);
  });

  it("puts nothing in the artefact when the run left anything but baselines", () => {
    const writes = `${WRITES_BASELINE} && echo pwned >"$out/package.json"`;
    const { status, stderr, artefact } = runCi({ FAKE_CONTAINER_WRITES: writes });
    expect(status).toBe(1);
    expect(stderr).toContain("the run left something other than baselines");
    expect(stderr).toContain("  package.json\n");
    expect(readdirSync(artefact)).toEqual([]);
  });

  it("refuses to run outside CI's Baselines job", () => {
    const { status, stderr } = run(["ci"]);
    expect(status).toBe(1);
    expect(stderr).toContain("runs only in CI's Baselines job");
    // Nor outside GitHub Actions with the artefact's directory, nor in it without one.
    expect(run(["ci"], { UF_BASELINE_ARTEFACT: join(tmpdir(), "uf-unused") }).status).toBe(1);
    expect(run(["ci"], { GITHUB_ACTIONS: "true" }).status).toBe(1);
  });
});

describe("baselines.sh download", () => {
  it("copies the run's baselines artefact into the cases, whichever page of its artefacts holds it", () => {
    const { status, stdout, gh, repo } = runDownload(["42"], {
      [BASELINE]: "png",
      [GEOMETRY]: "{}",
    });
    expect(status).toBe(0);
    expect(readFileSync(join(repo, BASELINE), "utf8")).toBe("png");
    expect(readFileSync(join(repo, GEOMETRY), "utf8")).toBe("{}");
    expect(stdout).toContain(`baseline: ${GEOMETRY}`);
    const fetched = gh.find((call) => call[1] === "download");
    expect(fetched!.slice(0, 5)).toEqual(["run", "download", "42", "--name", "baselines"]);
    // The first page of the unfiltered list (FIRST_PAGE) doesn't hold it: the server filters.
    expect(gh.find((call) => call[0] === "api")![1]).toBe(
      "repos/{owner}/{repo}/actions/runs/42/artifacts?name=baselines",
    );
  });

  it("takes the current branch's latest CI run by default", () => {
    const { status, gh, repo } = runDownload([], { [BASELINE]: "png" }, {}, (_root, planted) => ({
      FAKE_GH_RUNS: JSON.stringify([{ databaseId: 7 }]),
      FAKE_GH_RUN: ghRun({ head: commit(planted) }),
    }));
    expect(status).toBe(0);
    expect(gh[0]).toEqual([
      "run",
      "list",
      "--branch",
      "probe",
      "--workflow",
      "ci.yml",
      "--limit",
      "1",
      "--json",
      "databaseId",
      "--jq",
      ".[0].databaseId // empty",
    ]);
    expect(gh.find((call) => call[1] === "download")![2]).toBe("7");
    expect(existsSync(join(repo, BASELINE))).toBe(true);
  });

  it("refuses the branch's latest run when it is of another commit, unless it is named", () => {
    const latest = runDownload([], { [BASELINE]: "png" }, {}, (_root, planted) => {
      commit(planted);
      return { FAKE_GH_RUNS: JSON.stringify([{ databaseId: 7 }]) };
    });
    expect(latest.status).toBe(1);
    expect(latest.stderr).toContain("the latest run on probe, 7, is of abc123, not of HEAD.");
    expect(latest.gh.some((call) => call[1] === "download")).toBe(false);
    expect(existsSync(join(latest.repo, BASELINE))).toBe(false);

    const named = runDownload(["7"], { [BASELINE]: "png" }, {}, (_root, planted) => {
      commit(planted);
    });
    expect(named.status).toBe(0);
    expect(named.stderr).toContain("run 7 is of abc123, not of HEAD");
    expect(existsSync(join(named.repo, BASELINE))).toBe(true);
  });

  it("fails when the branch has no CI run", () => {
    const { status, stderr } = runDownload([], {}, {}, (_root, planted) => {
      commit(planted);
    });
    expect(status).toBe(1);
    expect(stderr).toContain("CI has no run on probe.");
  });

  it("writes nothing, and says so, when the run changed no baseline", () => {
    const { status, stdout, gh, repo } = runDownload(["42"], {}, { FAKE_GH_NAMED: artefacts([]) });
    expect(status).toBe(0);
    expect(stdout).toContain("run 42 changed no baseline; nothing was written.");
    expect(gh.some((call) => call[1] === "download")).toBe(false);
    expect(existsSync(join(repo, "tests", "integration", "cases"))).toBe(false);
  });

  it("fails without an artefact when the Baselines job did not succeed", () => {
    for (const conclusion of ["failure", "skipped"]) {
      const { status, stderr } = runDownload(
        ["42"],
        {},
        { FAKE_GH_NAMED: artefacts([]), FAKE_GH_RUN: ghRun({ conclusion }) },
      );
      expect(status).toBe(1);
      expect(stderr).toContain(
        `run 42 has no baselines artefact, and its Baselines job is ${conclusion}.`,
      );
    }
  });

  it("copies what a failed job uploaded, and fails", () => {
    const { status, stderr, repo } = runDownload(
      ["42"],
      { [BASELINE]: "png" },
      { FAKE_GH_RUN: ghRun({ conclusion: "failure" }) },
    );
    expect(status).toBe(1);
    expect(stderr).toContain("Baselines job is failure");
    expect(existsSync(join(repo, BASELINE))).toBe(true);
  });

  it("refuses the whole artefact when it holds anything but baselines", () => {
    const { status, stderr, repo } = runDownload(["42"], {
      [BASELINE]: "png",
      "tests/integration/cases/area/my-case/my-case.test.ts": "pwned",
      ".github/workflows/ci.yml": "pwned",
    });
    expect(status).toBe(1);
    expect(stderr).toContain("the artefact left something other than baselines");
    expect(stderr).toContain("  .github/workflows/ci.yml\n");
    expect(existsSync(join(repo, "tests", "integration", "cases"))).toBe(false);
    expect(existsSync(join(repo, ".github"))).toBe(false);
  });

  it("waits for the Baselines job, and needs one", () => {
    const running = runDownload(
      ["42"],
      { [BASELINE]: "png" },
      { FAKE_GH_RUN: ghRun({ status: "in_progress", conclusion: "" }) },
    );
    expect(running.status).toBe(1);
    expect(running.stderr).toContain("run 42's Baselines job is in_progress");
    expect(running.gh.some((call) => call[1] === "download")).toBe(false);
    const push = runDownload(["42"], {}, { FAKE_GH_RUN: ghRun({ baselines: false }) });
    expect(push.status).toBe(1);
    expect(push.stderr).toContain("run 42 has no Baselines job");
  });

  it("needs a number for a run, and a branch to take the latest run of", () => {
    expect(runDownload(["latest"], {}).status).toBe(2);
    const detached = runDownload([], {}, {}, (_root, planted) => {
      commit(planted, { detach: true });
    });
    expect(detached.status).toBe(1);
    expect(detached.stderr).toContain("HEAD is detached");
    expect(detached.gh).toEqual([]);
  });
});

describe("CI's Baselines job", () => {
  const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");
  const job = workflow
    .slice(workflow.indexOf("\njobs:\n"))
    .split(/^ {2}(?=[a-z0-9-]+:\n)/m)
    .find((block) => block.startsWith("baselines:\n"));

  it("runs on pull requests and by hand, in the baseline image, and uploads the artefact download reads", () => {
    if (!job) throw new Error("ci.yml has no baselines job.");
    expect(job).toMatch(/^ {4}name: Baselines$/m);
    expect(job).toMatch(/^ {4}if: \$\{\{ github\.event_name != 'push' \}\}$/m);
    expect(/^on:\n((?: {2}.*\n)+)/m.exec(workflow)?.[1]).toMatch(
      /^ {2}pull_request:\n(?:.*\n)* {2}workflow_dispatch:$/m,
    );
    // GitHub's x64 runner: the one CI compares on, which ADR-0019's open item asked for.
    expect(job).toMatch(/^ {4}runs-on: ubuntu-latest$/m);
    expect(job).toMatch(/^ {6}image: (\S+)$/m);
    const artefact = /^ {10}UF_BASELINE_ARTEFACT: (\S+)$/m.exec(job)?.[1];
    expect(artefact).toBeDefined();
    expect(job).toContain("run: bash tests/integration/scripts/baselines.sh ci\n");
    // A failed run still uploads what its reference wrote.
    expect(job).toMatch(
      /^ {8}if: \$\{\{ !cancelled\(\) \}\}\n {8}uses: actions\/upload-artifact@/m,
    );
    expect(job).toMatch(/^ {10}name: baselines$/m);
    expect(job).toContain(`          path: ${artefact}\n`);
    expect(job).toMatch(/^ {10}if-no-files-found: ignore$/m);
    // CI never commits: no credentials, and nothing pushes.
    expect(job).toContain("persist-credentials: false");
    expect(job).not.toMatch(/git push|contents: write/);
  });
});

describe("the baseline image", () => {
  it("is the baseline environment's, which CI's browser jobs run in", () => {
    const script = readFileSync(join(SCRIPTS, "baselines.sh"), "utf8");
    const image = /^IMAGE="([^"]+)"$/m.exec(script)?.[1];
    expect(`${image} linux/amd64`).toBe(BASELINE_ENVIRONMENT);
    const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");
    const images = [...workflow.matchAll(/image: (mcr\.microsoft\.com\/playwright:\S+)/g)];
    expect(images.length).toBeGreaterThan(0);
    for (const [, used] of images) expect(used).toBe(image);
  });
});

describe("baselines-in-container.sh", () => {
  it("parses", () => {
    const { status, stderr } = spawnSync(
      "bash",
      ["-n", join(SCRIPTS, "baselines-in-container.sh")],
      { encoding: "utf8" },
    );
    expect(stderr).toBe("");
    expect(status).toBe(0);
  });
});
