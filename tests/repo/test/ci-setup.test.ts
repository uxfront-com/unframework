import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { root } from "./workspace.ts";

/**
 * The lines of a workflow that install or cache dependencies on their own, each with its line
 * number. Every job that installs calls .github/actions/setup, which holds the install and the
 * weekly pnpm store cache with its fallback (#215), so a job that installs by itself, or uses
 * setup-node's `cache: pnpm`, which restores only the exact lockfile key, loses that fallback.
 * Nothing prunes the store either, since `pnpm store prune` deletes the packages pnpm copies rather
 * than links, like esbuild, which every restore then downloads again. Comment lines are skipped,
 * so prose that names a command isn't read as a step that runs it.
 */
function ownSetup(workflow: string): string[] {
  const own = [
    /\bpnpm install\b/,
    /\bpnpm store prune\b/,
    /^[ \t]*cache:[ \t]*pnpm\b/,
    /\bactions\/cache@/,
  ];
  return workflow
    .split(/\r?\n/)
    .flatMap((line, index) =>
      !/^[ \t]*#/.test(line) && own.some((pattern) => pattern.test(line))
        ? [`${index + 1}: ${line.trim()}`]
        : [],
    );
}

const workflow = (name: string): string =>
  readFileSync(join(root, ".github", "workflows", name), "utf8");

describe("CI's dependency setup", () => {
  it.each(["ci.yml", "nightly.yml"])("lives in the setup action, in %s", (name) => {
    const text = workflow(name);
    expect(text).toMatch(/^[ \t-]*uses:[ \t]*\.\/\.github\/actions\/setup[ \t]*$/m);
    expect(ownSetup(text)).toEqual([]);
  });

  it("names each line that installs or caches on its own", () => {
    const fixture = [
      "jobs:",
      "  bare:",
      "    steps:",
      "      # pnpm install, in a comment, is no install",
      "      - uses: ./.github/actions/setup",
      "      - uses: actions/setup-node@0 # v1",
      "        with:",
      "          cache: pnpm",
      "      - run: pnpm install --frozen-lockfile",
      "      - uses: actions/cache@0 # v1",
      "      - run: pnpm store prune",
    ].join("\n");
    expect(ownSetup(fixture)).toEqual([
      "8: cache: pnpm",
      "9: - run: pnpm install --frozen-lockfile",
      "10: - uses: actions/cache@0 # v1",
      "11: - run: pnpm store prune",
    ]);
  });
});
