// What Turborepo hashes for this package's `test` task: everything the harness reads must be in
// it, or `pnpm test` replays a cached pass after the file changed. Asked of turbo itself
// (`--dry=json`), so the test follows how the installed version resolves turbo.json.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT, ROOT } from "./paths.ts";
import { selectTargets } from "./targets.ts";

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

  it("hashes every toolchain's tsconfig through its transit node", () => {
    for (const target of selectTargets(undefined)) {
      const id = `@unframework/toolchain-${target}#transit`;
      expect(test.dependencies).toContain(id);
      const transit = tasks.find((task) => task.taskId === id);
      expect(Object.keys(transit?.inputs ?? {}), id).toContain("tsconfig.json");
    }
  });
});
