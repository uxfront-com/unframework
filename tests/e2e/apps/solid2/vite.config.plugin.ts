import { fileURLToPath } from "node:url";

import solid from "@solidjs/vite-plugin";
import unframework from "@unframework.dev/unplugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
	root: fileURLToPath(new URL("./src/plugin", import.meta.url)),
	// No `target`: the plugin detects solid@2 from @solidjs/vite-plugin and the solid-js 2 the app
	// installs (ADR-0102).
	plugins: [unframework(), solid()],
});
