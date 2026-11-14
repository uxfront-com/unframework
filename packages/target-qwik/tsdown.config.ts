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
  // The toolchain runs the consumer's Qwik and Vite (one Qwik runtime per page), which are
  // development dependencies here: never bundle them.
  deps: { neverBundle: [/^@qwik\.dev\//, "vite"] },
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
});

export default config;
