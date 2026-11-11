import { fileURLToPath } from "node:url";

import unframework from "@unframework.dev/unplugin/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/plugin", import.meta.url)),
  plugins: [
    // No `target`: the plugin detects Vue from plugin-vue.
    unframework(),
    vue(),
  ],
});
