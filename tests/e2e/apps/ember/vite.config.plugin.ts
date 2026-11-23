import { fileURLToPath } from "node:url";

import { ember } from "@nullvoxpopuli/ember-vite";
import unframework from "@unframework.dev/unplugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/plugin", import.meta.url)),
  // No `target`: the plugin detects Ember from @embroider/vite's template-tag plugin.
  plugins: [unframework(), ember()],
});
