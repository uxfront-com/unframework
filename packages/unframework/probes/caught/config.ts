// What `defineConfig` catches as a project writes its `unframework.config.ts` (plan §8.1).
import { defineConfig } from "@uxfront/unframework/config";

export const unknownTarget = defineConfig({
  // @ts-expect-error TS2820 `reac` is not a built-in target
  targets: ["reac"],
});
