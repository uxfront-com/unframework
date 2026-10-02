import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: [
    "src/index.ts",
    "src/toolchain/index.ts",
    "src/toolchain/client.ts",
    "src/toolchain/server.ts",
  ],
  unbundle: true,
  // The toolchain's frameworks, compilers and Vite plugins come from the project that runs the
  // tests: never copy them into dist.
  deps: { neverBundle: true },
  platform: "node",
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
});

export default config;
