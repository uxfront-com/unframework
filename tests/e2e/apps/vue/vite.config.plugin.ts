import { readFileSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import unframework from "@unframework/unplugin/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/plugin", import.meta.url)),
  plugins: [
    // No `target`: the plugin detects Vue from plugin-vue.
    unframework(),
    vue({
      script: {
        // A compiled `.uf.tsx` imports its prop types from a sibling module, as a packaged SFC
        // does. Vue's compiler reads those through TypeScript's `sys`, which TypeScript 7 no longer
        // exports, so a consumer on it passes the file system itself.
        fs: {
          fileExists: (file) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false,
          readFile: (file) => readFileSync(file, "utf8"),
          realpath: realpathSync,
        },
      },
    }),
  ],
});
