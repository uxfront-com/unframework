// What `defineConfig` catches as a project writes its `unframework.config.ts` (plan §8.1).
import { defineConfig } from "@uxfront/unframework/config";

export const unknownTarget = defineConfig({
  // @ts-expect-error TS2820 `reac` is not a built-in target
  targets: ["reac"],
});

export const pluginList = defineConfig({
  // @ts-expect-error TS2322 every server takes a fresh set of plugins, so the config comes from a function
  vite: [{ name: "engine" }],
});

export const pluginEntry = defineConfig({
  // @ts-expect-error TS2322 a plugin has a name
  vite: () => ({ plugins: [42] }),
});

export const unknownFonts = defineConfig({
  // @ts-expect-error TS2322 the fonts are a list of family names
  liveFonts: "any",
});
