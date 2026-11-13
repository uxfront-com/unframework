import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: ["src/index.ts", "src/browser.ts", "src/cli.ts", "src/preview/frame.ts"],
  unbundle: true,
  platform: "node",
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
});

export default config;
