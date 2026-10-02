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
  // The toolchain's adapters import the application's own Angular (one instance per page), and
  // its compiler stack is loaded from the toolchain directory: nothing is bundled.
  deps: { neverBundle: true },
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
});

export default config;
