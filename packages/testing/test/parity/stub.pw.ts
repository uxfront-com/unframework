// One Playwright test per stub spec, on the stub target.
import { globSync } from "node:fs";
import { join } from "node:path";

import type { SerializedLocatorLike } from "../../src/commands.ts";
import type { DriverCommandContext } from "../../src/driver/commands.ts";
import { declareSpecTests } from "../../src/driver/index.ts";
import { stubBuild } from "./playwright.config.ts";
import { casesDir, fixtureHarness, packageRoot, STUB_CAPABILITIES } from "./project.ts";

const patterns = (process.env.UF_STUB_SPECS ?? "*/*.parity.spec.ts").split(",");

declareSpecTests({
  root: packageRoot,
  specs: globSync(patterns, { cwd: join(casesDir, "stub") })
    .map((file) => join(casesDir, "stub", file))
    .toSorted(),
  project: () => ({
    directory: stubBuild,
    config: {
      provided: {
        target: "dom",
        ufHarness: fixtureHarness(process.env),
        ufCapabilities: STUB_CAPABILITIES,
        ufNoOutput: {},
      },
      // The harness's: the setup bounds `expect.element` by the poll timeout, and requires one.
      pollTimeout: 5_000,
      testTimeout: 60_000,
      hookTimeout: 30_000,
      requireAssertions: true,
    },
    commands: {
      // For the stubs that compare pixels themselves: raster, text-runs.
      ufStubScreenshot: async (context: DriverCommandContext, target: SerializedLocatorLike) => {
        const png = await context.iframe.locator(target.selector).screenshot({
          animations: "disabled",
          caret: "hide",
          scale: "css",
          type: "png",
          timeout: 5_000,
        });
        return png.toString("base64");
      },
    },
  }),
});
