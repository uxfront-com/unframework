import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: [
    "src/index.ts",
    "src/internal.ts",
    "src/setup.ts",
    "src/config/index.ts",
    "src/cli.ts",
    "src/ssr/index.ts",
    "src/ssr/spec.ts",
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
