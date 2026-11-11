import { fileURLToPath } from "node:url";

import { qwikVite } from "@qwik.dev/core/optimizer";
import unframework from "@unframework.dev/unplugin/vite";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("./src/plugin", import.meta.url));

export default defineConfig({
  root,
  plugins: [
    // No `target`: the plugin detects Qwik from its optimizer's plugin.
    unframework(),
    // Client-rendered, so that it needs no server entry. The plugin's default `srcDir` is `<root>/src`.
    qwikVite({ csr: true, srcDir: root }),
  ],
});
