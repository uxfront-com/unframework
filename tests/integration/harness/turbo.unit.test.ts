// What Turborepo hashes for this package's `test` task: everything the harness reads must be in
// it, or `pnpm test` replays a cached pass after the file changed. Asked of turbo itself
// (`--dry=json`), so the test follows how the installed version resolves turbo.json.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT, ROOT } from "./paths.ts";
import { selectTargets } from "./targets.ts";

/** The targets whose toolchain lints with ESLint too: oxlint cannot read their templates. */
const ESLINT_TARGETS: ReadonlySet<string> = new Set(["vue", "svelte", "astro", "angular"]);

/**
 * The lint hosts a toolchain installs, which run its type-aware rules in ESLint on TypeScript 6
 * (ADR-0042, amended): the toolchain's transit node depends on the host's, which hashes its
 * configuration.
 */
const ESLINT_HOSTS: Readonly<Record<string, string>> = {
  qwik: "@unframework/toolchain-qwik-eslint",
};

interface DryTask {
  taskId: string;
  inputs: Record<string, string>;
  dependencies: string[];
}

function dryRun(): DryTask[] {
  const result = spawnSync(
    join(REPO_ROOT, "node_modules", ".bin", "turbo"),
    ["run", "test", "--dry=json", "--filter=@unframework/integration"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  expect(result.status, result.stderr).toBe(0);
  return (JSON.parse(result.stdout) as { tasks: DryTask[] }).tasks;
}

describe("the integration test task", () => {
  const tasks = dryRun();
  const test = tasks.find((task) => task.taskId === "@unframework/integration#test")!;

  it("hashes CI's workflow, which the harness's own tests read", () => {
    expect(Object.keys(test.inputs)).toContain("../../.github/workflows/ci.yml");
  });

  it("hashes every toolchain's tsconfig and lint configurations through its transit node", () => {
    for (const target of selectTargets(undefined)) {
      const id = `@unframework/toolchain-${target}#transit`;
      expect(test.dependencies).toContain(id);
      const transit = tasks.find((task) => task.taskId === id);
      const inputs = Object.keys(transit?.inputs ?? {});
      expect(inputs, id).toContain("tsconfig.json");
      // L5 (ADR-0042): oxlint everywhere, and ESLint for the template languages.
      expect(inputs, id).toContain("output.oxlintrc.json");
      if (ESLINT_TARGETS.has(target)) expect(inputs, id).toContain("eslint.config.js");
      const host = ESLINT_HOSTS[target];
      if (host === undefined) continue;
      expect(transit?.dependencies, id).toContain(`${host}#transit`);
      const hostTransit = tasks.find((task) => task.taskId === `${host}#transit`);
      expect(Object.keys(hostTransit?.inputs ?? {}), host).toContain("eslint.config.js");
    }
  });
});
