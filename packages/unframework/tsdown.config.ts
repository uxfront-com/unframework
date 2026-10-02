import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: ["src/index.ts", "src/jsx-runtime.ts", "src/jsx-dev-runtime.ts"],
  unbundle: true,
  platform: "neutral",
  dts: true,
  // `.js` and `.d.ts`, which publishConfig.exports name.
  fixedExtension: false,
  // Copied into the output directory after the bundle is written, so these replace what the
  // declaration bundler made of them: `client.d.ts` is a script (the ambient `*.css` module) that it
  // would not emit at all, and it would reprint the vendored file without the upstream licence notice.
  copy: [{ from: ["src/client.d.ts", "src/vendor/vue-jsx.d.ts"], flatten: false }],
  // The declaration emitter drops triple-slash references; this one makes CSS side-effect imports
  // type-check wherever the JSX types load.
  banner: ({ fileName }) =>
    fileName === "jsx-runtime.d.ts" ? { dts: '/// <reference path="./client.d.ts" />' } : undefined,
});

export default config;
