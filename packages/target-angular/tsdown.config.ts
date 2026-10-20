import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: [
    "src/index.ts",
    "src/toolchain/index.ts",
    "src/toolchain/client.ts",
    "src/toolchain/server.ts",
    // Started by URL from ngtsc-virtual, so nothing imports it for the build to follow.
    "src/toolchain/ngtsc-worker.ts",
  ],
  unbundle: true,
  platform: "node",
  // The toolchain's adapters import the application's own Angular (one instance per page), and
  // its compiler stack is loaded from the toolchain directory: nothing is bundled.
  deps: { neverBundle: true },
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
  // No `//#region src/….ts` markers: a built file names no source file, so the built
  // ngtsc-virtual can only start the built worker.
  inputOptions: { experimental: { attachDebugInfo: "none" } },
});

export default config;
