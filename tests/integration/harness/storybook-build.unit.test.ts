// `storybook:build` hands the aborts file to each Storybook process it starts, and starts another
// while an abort names a new module (`@unframework/visual`'s failure isolation). Storybook's process
// is stubbed: the visual package's tests cover what a real build writes to that file.
import type * as ChildProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { build } from "../scripts/storybook.ts";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", async (original) => ({
  ...(await original<typeof ChildProcess>()),
  spawn,
}));

interface SpawnOptions {
  env: NodeJS.ProcessEnv;
}

/** Stands in for Storybook: each run may write the aborts file its env names, then exits. */
function storybookRuns(runs: { aborted?: string[]; code: number }[]): void {
  spawn.mockImplementation((_bin: string, _args: string[], { env }: SpawnOptions) => {
    const run = runs[spawn.mock.calls.length - 1]!;
    if (run.aborted) {
      const file = env.UF_STORYBOOK_ABORTS!;
      mkdirSync(dirname(file), { recursive: true });
      const failures = run.aborted.map((module) => ({ module, cause: "link error" }));
      writeFileSync(file, JSON.stringify(failures));
    }
    const child = new EventEmitter();
    setImmediate(() => child.emit("exit", run.code, null));
    return child;
  });
}

describe("storybook:build", () => {
  afterEach(() => {
    const options = spawn.mock.calls[0]?.[2] as SpawnOptions | undefined;
    if (options) rmSync(options.env.UF_STORYBOOK_ABORTS!, { force: true });
    spawn.mockReset();
  });

  it("builds again when an abort names a module, and gives every run the file", async () => {
    storybookRuns([{ aborted: ["/cases/a/a.test.ts"], code: 1 }, { code: 0 }]);

    await expect(build("vue")).resolves.toBe(0);

    expect(spawn).toHaveBeenCalledTimes(2);
    for (const [, args, options] of spawn.mock.calls as [string, string[], SpawnOptions][]) {
      expect(args).toContain("build");
      expect(options.env.UF_STORYBOOK_ABORTS).toMatch(/[/\\]vue\.aborts\.json$/);
      // The rest of the environment still reaches it.
      expect(options.env.PATH).toBe(process.env.PATH);
    }
  });

  it("keeps the exit code of a build that names no module to fail", async () => {
    storybookRuns([{ code: 1 }]);

    await expect(build("vue")).resolves.toBe(1);

    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
