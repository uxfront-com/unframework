import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXCLUDED_JOBS,
  exitCode,
  FULL_STEPS,
  INTEGRATION,
  QUICK_COMPILE_VITEST_ARGS,
  quickSteps,
  quickUnitArgs,
  REPO_TESTS,
} from "../../../scripts/test-loop.ts";
import type { StepResult, StepStatus } from "../../../scripts/test-loop.ts";
import { root } from "./workspace.ts";

/**
 * The ids of a workflow's jobs, read as text: every key of the `jobs:` mapping, at the indentation
 * of its first key. GitHub allows letters, digits, `-` and `_` in an id, and YAML allows a quoted
 * key and a comment after it, so the pattern takes all of them (a narrower one let `qa_job:` and
 * `qa-job: # …` through).
 */
function workflowJobIds(workflow: string): string[] {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => /^jobs:[ \t]*(?:#.*)?$/.test(line));
  if (start === -1) return [];
  const ids: string[] = [];
  let indent: string | undefined;
  for (const line of lines.slice(start + 1)) {
    if (/^[ \t]*(?:#.*)?$/.test(line)) continue;
    // The next top-level key ends the mapping.
    if (!/^[ \t]/.test(line)) break;
    indent ??= /^[ \t]+/.exec(line)?.[0] ?? "";
    if (!line.startsWith(indent) || /^[ \t]/.test(line.slice(indent.length))) continue;
    const key = /^(["']?)([A-Za-z_][\w-]*)\1:[ \t]*(?:#.*)?$/.exec(line.slice(indent.length));
    // A line at the jobs' indentation that isn't a plain key fails the guard, not skips it.
    ids.push(key?.[2] ?? `<unreadable: ${line.trim()}>`);
  }
  return ids;
}

/** The job ids of CI's workflow. */
function ciJobs(): string[] {
  return workflowJobIds(readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8"));
}

/** The job ids the left-out list in `.github/CONTRIBUTING.md` names, from lines like ``- `check`: …``. */
function contributingExcludedJobs(contributing: string): string[] {
  const section = contributing.slice(contributing.indexOf("## Verifying a change"));
  return [...section.matchAll(/^[ \t]*- ((?:`[\w-]+`(?:, | and )?)+):/gm)].flatMap((match) =>
    [...(match[1] ?? "").matchAll(/`([\w-]+)`/g)].map((id) => id[1] ?? ""),
  );
}

function result(status: StepStatus): StepResult {
  return { name: status, status, seconds: 0 };
}

describe("test:quick", () => {
  it("selects the changed packages without their dependents, leaving the corpus's full run out", () => {
    const args = quickUnitArgs("abc123");
    expect(args).toContain("--filter=[abc123]");
    expect(args.some((arg) => arg.includes("...["))).toBe(false);
    expect(args).toContain(`--filter=!${INTEGRATION}`);
    expect(args).toContain(`--filter=${REPO_TESTS}`);
  });

  it("runs the corpus's compile project alone", () => {
    const compile = quickSteps("abc123").find((step) => step.name === "compile");
    const args = compile?.commands[0]?.args ?? [];
    expect(args).toContain("--");
    expect(args.slice(args.indexOf("--") + 1)).toEqual(["--project", "compile"]);
    expect(QUICK_COMPILE_VITEST_ARGS).toEqual(["--project", "compile"]);
  });
});

describe("test:full", () => {
  it("covers every job of ci.yml once, or names it as left out with a reason", () => {
    const jobs = ciJobs();
    expect(jobs.length).toBeGreaterThan(0);
    const covered = FULL_STEPS.flatMap((step) => step.jobs);
    const excluded = Object.keys(EXCLUDED_JOBS);
    for (const job of jobs) {
      const count = covered.filter((id) => id === job).length + (excluded.includes(job) ? 1 : 0);
      expect(
        count,
        `ci.yml's job \`${job}\`: add it to a step of FULL_STEPS in scripts/test-loop.ts, or to EXCLUDED_JOBS with a reason`,
      ).toBe(1);
    }
    for (const job of [...covered, ...excluded]) {
      expect(jobs, `scripts/test-loop.ts names \`${job}\`, which ci.yml has no job for`).toContain(
        job,
      );
    }
    for (const [job, reason] of Object.entries(EXCLUDED_JOBS)) {
      expect(reason, job).not.toBe("");
    }
  });

  it("names the jobs it leaves out in .github/CONTRIBUTING.md's list", () => {
    const contributing = readFileSync(join(root, ".github", "CONTRIBUTING.md"), "utf8");
    expect(contributingExcludedJobs(contributing).toSorted()).toEqual(
      Object.keys(EXCLUDED_JOBS).toSorted(),
    );
  });
});

describe("workflowJobIds", () => {
  it("reads every job id GitHub allows, with or without a comment, spaces or quotes after it", () => {
    const workflow = [
      "name: CI",
      "on: push",
      "jobs:",
      "  # a comment between jobs",
      "  qa-job:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo",
      "  qa_job:",
      "    runs-on: ubuntu-latest",
      "  QaJob: # probe",
      "    runs-on: ubuntu-latest",
      "  trailing:  ",
      "    runs-on: ubuntu-latest",
      "",
      '  "quoted":',
      "    runs-on: ubuntu-latest",
      "  _private:\r",
      "    runs-on: ubuntu-latest",
      "concurrency: ci",
      "  not-a-job:",
    ].join("\n");
    expect(workflowJobIds(workflow)).toEqual([
      "qa-job",
      "qa_job",
      "QaJob",
      "trailing",
      "quoted",
      "_private",
    ]);
  });

  it("reads jobs at any indentation", () => {
    expect(workflowJobIds("jobs:\n    one:\n        runs-on: x\n    two:\n")).toEqual([
      "one",
      "two",
    ]);
  });

  it("turns a line it can't read at the jobs' indentation into an id no step names", () => {
    expect(workflowJobIds("jobs:\n  one:\n  two: { runs-on: x }\n")).toEqual([
      "one",
      "<unreadable: two: { runs-on: x }>",
    ]);
  });
});

describe("the loops", () => {
  it("are the root scripts", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(manifest.scripts["test:quick"]).toBe("node scripts/test-loop.ts quick");
    expect(manifest.scripts["test:full"]).toBe("node scripts/test-loop.ts full");
  });

  it("exit 0 only when every step passed or was skipped", () => {
    expect(exitCode([])).toBe(0);
    expect(exitCode([result("passed"), result("skipped")])).toBe(0);
    expect(exitCode([result("passed"), result("failed")])).toBe(1);
    expect(exitCode([result("failed"), result("skipped")])).toBe(1);
  });
});
