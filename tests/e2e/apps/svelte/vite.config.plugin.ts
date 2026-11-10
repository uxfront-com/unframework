import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import unframework from "@unframework/unplugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/plugin", import.meta.url)),
  // No `target`: the plugin detects Svelte from vite-plugin-svelte.
  plugins: [unframework(), svelte()],
});
