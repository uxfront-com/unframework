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

/** The job ids under `jobs:` in CI's workflow, read as text, as the harness's canary tests do. */
function ciJobs(): string[] {
  const workflow = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
  return [...workflow.slice(workflow.indexOf("\njobs:\n")).matchAll(/^ {2}([a-z0-9-]+):\n/gm)].map(
    (match) => match[1] ?? "",
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

  it("names the jobs it leaves out in .github/CONTRIBUTING.md", () => {
    const contributing = readFileSync(join(root, ".github", "CONTRIBUTING.md"), "utf8");
    for (const job of Object.keys(EXCLUDED_JOBS)) {
      expect(contributing, job).toContain(`\`${job}\``);
    }
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
