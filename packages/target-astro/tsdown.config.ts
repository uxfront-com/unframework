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
  // The toolchain runs the consumer's Astro, Vite and Vitest (one Astro runtime per render),
  // which are development dependencies here: never bundle them, nor their types.
  deps: { neverBundle: ["astro", /^astro\//, /^@astrojs\//, "vite", "vitest", /^vitest\//] },
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
});

export default config;
