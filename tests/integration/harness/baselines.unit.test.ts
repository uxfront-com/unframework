// `pnpm test:baselines` on the host: scripts/baselines.sh, run from a copy of the repository
// layout with a stand-in `docker` that records how it was called and plays the container: in
// update mode, each test decides what the container leaves in its /out. The container half
// needs the Playwright image; here it is only parsed.
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

/** What the container leaves in /out by default: one changed baseline. */
const WRITES_BASELINE = `mkdir -p "$out/$(dirname "${BASELINE}")" && printf png >"$out/${BASELINE}"`;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function run(
  args: string[],
  env: Record<string, string> = {},
  prepare?: (root: string, repo: string) => void,
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
  const temp = join(root, "tmp");
  mkdirSync(temp);
  const log = join(root, "docker.log");
  prepare?.(root, repo);
  const result = spawnSync("bash", [join(scripts, "baselines.sh"), ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      TMPDIR: temp,
      FAKE_DOCKER_LOG: log,
      FAKE_DOCKER_CONTAINERS: join(root, "containers"),
      FAKE_CONTAINER_WRITES: WRITES_BASELINE,
      UF_BASELINE_PLATFORM: "",
      ...env,
    },
  });
  const calls = existsSync(log)
    ? readFileSync(log, "utf8")
        .split("--end--\n")
        .filter(Boolean)
        .map((call) => call.trimEnd().split("\n"))
    : [];
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    calls,
    root,
    repo,
    temp,
  };
}

/** Runs `update` with a container that leaves exactly `staged` in its /out. */
function updateWith(staged: readonly string[]) {
  return run(
    ["update"],
    { FAKE_CONTAINER_WRITES: 'cp -R "$FAKE_DOCKER_CONTAINERS/../stage/." "$out"' },
    (root) => {
      for (const path of staged) {
        mkdirSync(dirname(join(root, "stage", path)), { recursive: true });
        writeFileSync(join(root, "stage", path), "baseline");
      }
    },
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
