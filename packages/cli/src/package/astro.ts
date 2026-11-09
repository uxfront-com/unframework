import type { Packager } from "./packager.ts";
import { writeFiles } from "./packager.ts";

/** Plan §8.4: Astro's compiler builds the emitted sources in the consumer's app. */
export const astro: Packager = {
  peer: { name: "astro", range: "^7.0.0" },
  needs: [],
  exports: "./astro/index.ts",
  run: ({ files, out }) => writeFiles(out, files),
};
