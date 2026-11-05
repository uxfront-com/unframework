import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: [
    "src/index.ts",
    "src/bun.ts",
    "src/esbuild.ts",
    "src/farm.ts",
    "src/rolldown.ts",
    "src/rollup.ts",
    "src/rsbuild.ts",
    "src/rspack.ts",
    "src/unloader.ts",
    "src/vite.ts",
    "src/webpack.ts",
  ],
  unbundle: true,
  platform: "node",
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
});

export default config;
