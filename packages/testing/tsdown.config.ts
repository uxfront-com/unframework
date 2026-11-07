import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: [
    "src/index.ts",
    "src/hosts/page/setup.ts",
    "src/hosts/page/runner.ts",
    "src/hosts/page/vitest.ts",
    "src/hosts/vitest/setup.ts",
    "src/setup.ts",
    "src/normalize/index.ts",
    "src/node/index.ts",
    "src/targets/*.ts",
  ],
  unbundle: true,
  platform: "neutral",
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
});

export default config;
