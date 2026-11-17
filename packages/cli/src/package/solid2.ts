import { pathToFileURL } from "node:url";

import type { Packager, PackagerInput } from "./packager.ts";
import { buildWithTsdown } from "./tsdown.ts";

const COMPILER = "@solidjs/compiler";

/** The part of @solidjs/compiler this calls. */
interface SolidCompiler {
  transformAsync(code: string, options: object): Promise<{ code: string }>;
}

/**
 * As for Solid 1, JSX means nothing without Solid's compiler, and tsdown has none: it keeps the JSX,
 * and this compiles each chunk for the DOM with Solid 2's native compiler, as a Solid library's
 * plain JS is. A consumer with the compiler reads the preserved JSX through the `solid` condition
 * instead, which also serves its SSR (ADR-0102).
 */
async function solidCompiler({ resolve }: PackagerInput): Promise<object> {
  const compiler: SolidCompiler = await import(
    /* @vite-ignore */ pathToFileURL(resolve(COMPILER)).href
  );
  return {
    name: "unframework:solid2-compiler",
    renderChunk: async (code: string, chunk: { fileName: string }) =>
      (
        await compiler.transformAsync(code, {
          // The compiler reads JSX by the file's extension, and a chunk is named `.js`.
          filename: chunk.fileName.replace(/\.js$/, ".jsx"),
          generate: "dom",
          moduleName: "@solidjs/web",
        })
      ).code,
  };
}

/** Plan §8.4 for `solid@2`: JS and `.d.ts` through tsdown, and preserved JSX under `solid`. */
export const solid2: Packager = {
  peer: [
    { name: "solid-js", range: "^2.0.0" },
    { name: "@solidjs/web", range: "^2.0.0" },
  ],
  needs: ["tsdown", COMPILER],
  types: "solid-js",
  exports: {
    types: "./solid2/index.d.ts",
    solid: "./solid2/index.jsx",
    default: "./solid2/index.js",
  },
  run: async (input) => {
    await buildWithTsdown(input, { jsx: "preserve", jsxImportSource: "@solidjs/web" }, [
      { extension: ".jsx" },
      { extension: ".js", plugins: [await solidCompiler(input)] },
    ]);
  },
};
