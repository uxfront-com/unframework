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
  platform: "node",
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
  // The toolchain runs the consumer's own framework, compiler and Vite plugin, never a bundled
  // copy: a second runtime instance would not render the consumer's components.
  deps: { neverBundle: true },
});

export default config;
