// A `.gts` module as Ember's build compiles it: content-tag turns each `<template>` into a
// `template()` call, then Babel strips the types, compiles the templates with the template
// compiler of the `ember-source` the project installs, and lowers the decorators (`@tracked`).
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { TransformOptions } from "@babel/core";

/** A compiled module: its code, with its source map. */
export interface CompiledGts {
  code: string;
  map: unknown;
}

const require = createRequire(import.meta.url);

/** The template compilers loaded so far, by the directory `ember-source` resolves from. */
const compilers = new Map<string, Promise<unknown>>();

/** Ember's template compiler, from the `ember-source` that resolves from `root`. */
function templateCompiler(root: string): Promise<unknown> {
  let compiler = compilers.get(root);
  if (!compiler) {
    const resolved = createRequire(join(root, "package.json")).resolve(
      "ember-source/ember-template-compiler/index.js",
    );
    compiler = import(pathToFileURL(resolved).href);
    compilers.set(root, compiler);
  }
  return compiler;
}

/**
 * Compiles a `.gts` module whose `ember-source` resolves from `root`. Throws what content-tag,
 * Babel or the template compiler throws: L3 reports it.
 */
export async function compileGts(code: string, id: string, root: string): Promise<CompiledGts> {
  const [{ Preprocessor }, babel, compiler] = await Promise.all([
    import("content-tag"),
    import("@babel/core"),
    templateCompiler(root),
  ]);
  const preprocessed = new Preprocessor().process(code, { filename: id });
  const options: TransformOptions = {
    filename: id.replace(/\.gts$/, ".ts"),
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    // content-tag adds the template compiler's import at the top: Babel maps back through it to
    // the `.gts` module, line for line.
    inputSourceMap: JSON.parse(preprocessed.map) as TransformOptions["inputSourceMap"],
    presets: [[require.resolve("@babel/preset-typescript"), { allowDeclareFields: true }]],
    plugins: [
      [require.resolve("babel-plugin-ember-template-compilation"), { compiler }],
      [
        require.resolve("decorator-transforms"),
        { runtime: { import: require.resolve("decorator-transforms/runtime-esm") } },
      ],
    ],
  };
  const result = await babel.transformAsync(preprocessed.code, options);
  if (!result?.code) throw new Error(`Babel produced no code for ${id}.`);
  return { code: result.code, map: result.map };
}
