// The testing API's browser parity suite (`pnpm test` runs it after the unit and DOM projects of
// ../../vitest.config.ts). It needs the harness's deterministic browser context, its commands
// and a provided harness context, which the plain browser project does not have.
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { parityProject } from "./project.ts";

const config: ViteUserConfig = defineConfig({
  test: {
    projects: [parityProject()],
  },
});

export default config;
