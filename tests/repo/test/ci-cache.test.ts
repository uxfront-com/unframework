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
 * `actions/cache` step before it, whose restore key falls back to the newest store. The ISO week in
 * both keys limits how far a store grows, since `pnpm install` never removes a package: a fallback
 * reaches only a store from the same week. Nothing prunes the store, since `pnpm store prune`
 * deletes the packages pnpm copies rather than links, like esbuild, which every restore then
 * downloads again.
 */
function cacheProblems(job: Job): string[] {
  const install = job.steps.findIndex(installs);
  if (install === -1) return [];
  const problems: string[] = [];
  if (/^[ \t]+cache:[ \t]*pnpm[ \t]*$/m.test(job.text))
    problems.push("uses setup-node's cache: pnpm");
  if (job.steps.some((step) => /^[ \t-]*run:.*\bpnpm store prune\b/m.test(step)))
    problems.push("prunes the pnpm store");
  const cache = job.steps.findIndex((step) => /^[ \t-]*uses:[ \t]*actions\/cache@/m.test(step));
  if (cache === -1 || cache > install) {
    problems.push("has no actions/cache step before the install");
    return problems.map((problem) => `${job.id}: ${problem}`);
  }
  const step = job.steps[cache] ?? "";
  const week = /\$\{\{\s*steps\.[\w-]+\.outputs\.week\s*\}\}/;
  const key = /^[ \t]+key:[ \t]*(.*?)[ \t]*$/m.exec(step)?.[1];
  const restore = /^[ \t]+restore-keys:[ \t]*(.*?)[ \t]*$/m.exec(step)?.[1];
  const keyWeek = key === undefined ? undefined : week.exec(key)?.[0];
  if (keyWeek === undefined) problems.push("has no week in its cache key");
  if (restore === undefined || restore === "") {
    problems.push("has no restore-keys on its cache");
  } else {
    if (keyWeek === undefined || !restore.includes(keyWeek))
      problems.push("has no week of its key in its restore-keys");
    if (!restore.endsWith("-")) problems.push("has restore-keys that don't end in -");
  }
  return problems.map((problem) => `${job.id}: ${problem}`);
}

const ci = (): string => readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");

/** An `actions/cache` step of a fixture workflow. */
const cacheStep = (key: string, restore: string): string[] => [
  "      - uses: actions/cache@0 # v1",
  "        with:",
  `          key: ${key}`,
  ...(restore === "" ? [] : [`          restore-keys: ${restore}`]),
];

describe("CI's dependency cache", () => {
  it("falls back to the nearest store of the same week, in every job that installs", () => {
    const jobs = workflowJobs(ci());
    expect(jobs.filter((job) => job.steps.some(installs)).length).toBeGreaterThan(0);
    expect(jobs.flatMap(cacheProblems)).toEqual([]);
  });

  it("names each job that installs without the weekly fallback", () => {
    const week = "${{ steps.s.outputs.week }}";
    const hash = "${{ hashFiles('pnpm-lock.yaml') }}";
    const workflow = [
      "jobs:",
      "  bare:",
      "    steps:",
      "      - uses: actions/setup-node@0 # v1",
      "        with:",
      "          cache: pnpm",
      "      - run: pnpm install --frozen-lockfile",
      "  weekly:",
      "    steps:",
      ...cacheStep(`k-${week}-${hash}`, `k-${week}-`),
      "      # pnpm install, in a comment, is no install, and neither is pnpm store prune",
      "      - name: Install",
      "        run: pnpm install --frozen-lockfile",
      "  unlimited:",
      "    steps:",
      ...cacheStep(`k-${hash}`, "k-"),
      "      - run: pnpm install",
      "  exact:",
      "    steps:",
      ...cacheStep(`k-${week}-${hash}`, ""),
      "      - run: pnpm install",
      "  unprefixed:",
      "    steps:",
      ...cacheStep(`k-${week}-${hash}`, `k-${week}`),
      "      - run: pnpm install",
      "  pruned:",
      "    steps:",
      ...cacheStep(`k-${week}-${hash}`, `k-${week}-`),
      "      - run: pnpm install",
      "      - run: pnpm store prune",
      "  late:",
      "    steps:",
      "      - run: pnpm install",
      ...cacheStep(`k-${week}-${hash}`, `k-${week}-`),
      "  none:",
      "    steps:",
      "      - run: pnpm test",
    ].join("\n");
    expect(workflowJobs(workflow).flatMap(cacheProblems)).toEqual([
      "bare: uses setup-node's cache: pnpm",
      "bare: has no actions/cache step before the install",
      "unlimited: has no week in its cache key",
      "unlimited: has no week of its key in its restore-keys",
      "exact: has no restore-keys on its cache",
      "unprefixed: has restore-keys that don't end in -",
      "pruned: prunes the pnpm store",
      "late: has no actions/cache step before the install",
    ]);
  });
});
