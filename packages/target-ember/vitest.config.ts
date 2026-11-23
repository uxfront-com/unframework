import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { toolchain } from "./src/toolchain/index.ts";

/** Node only: the tests compile sources to `.gts` and render them on the server. */
const config: ViteUserConfig = defineConfig({
  ...(await toolchain.vite("ssr", {
    root: import.meta.dirname,
    toolchainDir: import.meta.dirname,
  })),
  test: { name: "unit", environment: "node", include: ["test/**/*.test.ts"] },
});

export default config;
