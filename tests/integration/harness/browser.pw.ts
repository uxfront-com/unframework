// One Playwright test per spec file, each run in the page (`packages/testing/src/driver`), once per
// project.
import type { TargetName } from "@unframework/compiler";
import { declareSpecTests } from "@unframework/testing/driver";
import type { TargetCommand } from "@unframework/testing/driver";
import { manifestEvents, readBuildManifest } from "@unframework/testing/node";

import { browserRun } from "./browser-run.ts";
import { toolchainContext } from "./engines.ts";
import { noOutputCases, standInCases } from "./no-output.ts";
import { ROOT, storybookOutput } from "./paths.ts";
import { PAGE_RULES } from "./playwright-rules.ts";
import { loadToolchain } from "./targets.ts";

const run = browserRun();

declareSpecTests({
  root: ROOT,
  specs: run.specs,
  project: async (target) => {
    // Beside the mode: a target's compiler loads only in a worker that runs its project.
    const [{ builtinTargets }, toolchain] = await Promise.all([
      import("@unframework/compiler"),
      loadToolchain(target),
    ]);
    const directory = storybookOutput(target, run.mode.canary);
    const manifest = readBuildManifest(directory);
    const commands = toolchain.browserCommands?.(toolchainContext(target));
    return {
      directory,
      config: {
        ...PAGE_RULES,
        provided: {
          target,
          ufHarness: run.harness,
          ufCapabilities: builtinTargets[target as TargetName].capabilities,
          ufNoOutput: noOutputCases(run.cases, target),
          ufStandIn: standInCases(run.cases, target, run.harness.quarantine),
        },
      },
      events: (file) => manifestEvents(manifest, file),
      ...(commands ? { commands: commands as Record<string, TargetCommand> } : {}),
    };
  },
});
