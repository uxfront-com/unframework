import { pathToFileURL } from "node:url";

import type { Packager, PackagerInput } from "./packager.ts";
import { buildWithTsdown } from "./tsdown.ts";

const BABEL = "@babel/core";
const PRESET = "babel-preset-solid";

/** The part of Babel this calls. */
interface Babel {
  transformAsync(code: string, options: object): Promise<{ code?: string | null } | null>;
}

/**
 * JSX means nothing without Solid's compiler, and tsdown has none: it keeps the JSX, and this
 * compiles each chunk for the DOM, as a Solid library's plain JS is. A consumer with the compiler
 * reads the preserved JSX through the `solid` condition instead, which also serves its SSR.
 */
async function solidCompiler({ resolve }: PackagerInput): Promise<object> {
  const babel: Babel = await import(/* @vite-ignore */ pathToFileURL(resolve(BABEL)).href);
  const options = {
    babelrc: false,
    configFile: false,
    compact: false,
    presets: [[resolve(PRESET), { generate: "dom", moduleName: "solid-js/web" }]],
  };
  return {
    name: "unframework:solid-compiler",
    renderChunk: async (code: string) => (await babel.transformAsync(code, options))?.code ?? code,
  };
}

/** Plan §8.4: JS and `.d.ts` through tsdown, and preserved JSX under a `solid` condition. */
export const solid: Packager = {
  peer: { name: "solid-js", range: "^1.9.0" },
  needs: ["tsdown", BABEL, PRESET],
  types: "solid-js",
  exports: {
    types: "./solid/index.d.ts",
    solid: "./solid/index.jsx",
    default: "./solid/index.js",
  },
  run: async (input) => {
    const inputOptions = { transform: { jsx: "preserve" } };
    await buildWithTsdown(input, { jsx: "preserve", jsxImportSource: "solid-js" }, [
      { extension: ".jsx", inputOptions },
      { extension: ".js", inputOptions, plugins: [await solidCompiler(input)] },
    ]);
  },
};
