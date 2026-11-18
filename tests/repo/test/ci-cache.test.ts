import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { root } from "./workspace.ts";

/** One job of a workflow: its id and its steps, each step's lines without comment lines. */
interface Job {
  id: string;
  text: string;
  steps: string[];
}

/**
 * The jobs of a workflow, read as text, as `test-loop.test.ts` reads their ids: every key of the
 * `jobs:` mapping at the indentation of its first key, and the job's steps, split at each `- ` item
 * one level below `steps:`. Comment lines are dropped, so prose that names a command isn't read as
 * a step that runs it.
 */
function workflowJobs(workflow: string): Job[] {
  const lines = workflow.split(/\r?\n/).filter((line) => !/^[ \t]*#/.test(line));
  const start = lines.findIndex((line) => /^jobs:[ \t]*$/.test(line));
  if (start === -1) return [];
  const jobs: { id: string; lines: string[] }[] = [];
  let indent: string | undefined;
  for (const line of lines.slice(start + 1)) {
    if (/^[ \t]*$/.test(line)) continue;
    if (!/^[ \t]/.test(line)) break;
    indent ??= /^[ \t]+/.exec(line)?.[0] ?? "";
    const key = /^(["']?)([A-Za-z_][\w-]*)\1:[ \t]*$/.exec(line.slice(indent.length));
    if (line.startsWith(indent) && !/^[ \t]/.test(line.slice(indent.length))) {
      jobs.push({ id: key?.[2] ?? `<unreadable: ${line.trim()}>`, lines: [] });
    } else {
      jobs.at(-1)?.lines.push(line);
    }
  }
  return jobs.map(({ id, lines: body }) => {
    const stepsAt = body.findIndex((line) => /^[ \t]+steps:[ \t]*$/.test(line));
    const steps: string[] = [];
    if (stepsAt !== -1) {
      const item = /^([ \t]+)- /.exec(body[stepsAt + 1] ?? "")?.[1];
      for (const line of body.slice(stepsAt + 1)) {
        if (item !== undefined && line.startsWith(`${item}- `)) steps.push(line);
        else if (steps.length > 0) steps[steps.length - 1] += `\n${line}`;
      }
    }
    return { id, text: body.join("\n"), steps };
  });
}

const installs = (step: string): boolean => /^[ \t-]*run:.*\bpnpm install\b/m.test(step);

/**
 * What a job that installs is missing, or nothing. setup-node's `cache: pnpm` restores only the
 * exact lockfile key, so a PR whose lockfile differs from main's, like a part on an integration
 * branch, started with an empty store and downloaded every package (UXF-858). The install takes an
 * `actions/cache` step with a restore key before it, and a prune after it on a partial or missed
 * hit, so the saved store holds only this lockfile's packages and doesn't grow.
 */
function cacheProblems(job: Job): string[] {
  const install = job.steps.findIndex(installs);
  if (install === -1) return [];
  const problems: string[] = [];
  if (/^[ \t]+cache:[ \t]*pnpm[ \t]*$/m.test(job.text))
    problems.push("uses setup-node's cache: pnpm");
  const cache = job.steps.findIndex((step) => /^[ \t-]*uses:[ \t]*actions\/cache@/m.test(step));
  if (cache === -1 || cache > install) {
    problems.push("has no actions/cache step before the install");
  } else {
    const step = job.steps[cache] ?? "";
    if (!/^[ \t]+restore-keys:[ \t]*\S/m.test(step))
      problems.push("has no restore-keys on its cache");
    const id = /^[ \t-]*id:[ \t]*([\w-]+)[ \t]*$/m.exec(step)?.[1];
    const prune = job.steps.findIndex(
      (candidate, index) =>
        index > install && /^[ \t-]*run:[ \t]*pnpm store prune\b/m.test(candidate),
    );
    if (prune === -1) {
      problems.push("has no pnpm store prune after the install");
    } else if (
      id === undefined ||
      !new RegExp(String.raw`^[ \t-]*if:.*steps\.${id}\.outputs\.cache-hit != 'true'`, "m").test(
        job.steps[prune] ?? "",
      )
    ) {
      problems.push("prunes without reading its cache step's cache-hit");
    }
  }
  return problems.map((problem) => `${job.id}: ${problem}`);
}

const ci = (): string => readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");

describe("CI's dependency cache", () => {
  it("falls back to the nearest store and prunes it, in every job that installs", () => {
    const jobs = workflowJobs(ci());
    expect(jobs.filter((job) => job.steps.some(installs)).length).toBeGreaterThan(0);
    expect(jobs.flatMap(cacheProblems)).toEqual([]);
  });

  it("names each job that installs without the fallback", () => {
    const workflow = [
      "jobs:",
      "  bare:",
      "    steps:",
      "      - uses: actions/setup-node@0 # v1",
      "        with:",
      "          cache: pnpm",
      "      - run: pnpm install --frozen-lockfile",
      "  fallback:",
      "    steps:",
      "      - id: deps",
      "        uses: actions/cache@0 # v1",
      "        with:",
      "          key: k-${{ hashFiles('pnpm-lock.yaml') }}",
      "          restore-keys: k-",
      "      # pnpm install, in a comment, is no install",
      "      - name: Install",
      "        run: pnpm install --frozen-lockfile",
      "      - if: steps.deps.outputs.cache-hit != 'true'",
      "        run: pnpm store prune",
      "  unpruned:",
      "    steps:",
      "      - id: deps",
      "        uses: actions/cache@0 # v1",
      "        with:",
      "          restore-keys: k-",
      "      - run: pnpm install",
      "  unconditional:",
      "    steps:",
      "      - id: deps",
      "        uses: actions/cache@0 # v1",
      "        with:",
      "          restore-keys: k-",
      "      - run: pnpm install",
      "      - run: pnpm store prune",
      "  none:",
      "    steps:",
      "      - run: pnpm test",
    ].join("\n");
    expect(workflowJobs(workflow).flatMap(cacheProblems)).toEqual([
      "bare: uses setup-node's cache: pnpm",
      "bare: has no actions/cache step before the install",
      "unpruned: has no pnpm store prune after the install",
      "unconditional: prunes without reading its cache step's cache-hit",
    ]);
  });
});
