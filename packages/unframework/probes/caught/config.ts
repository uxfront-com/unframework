// What `defineConfig` catches as a project writes its `unframework.config.ts` (plan §8.1).
import { defineConfig } from "@uxfront/unframework/config";

export const unknownTarget = defineConfig({
  // @ts-expect-error TS2820 `reac` is not a built-in target
  targets: ["reac"],
});

export const pluginList = defineConfig({
  // @ts-expect-error TS2322 every server takes a fresh set, so the plugins come from a function
  vitePlugins: [{ name: "engine" }],
});

export const unknownFonts = defineConfig({
  // @ts-expect-error TS2322 `system` is not a live-fonts mode
  liveFonts: "system",
});
