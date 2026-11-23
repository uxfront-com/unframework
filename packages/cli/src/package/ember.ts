import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { OutputFile } from "@unframework.dev/compiler";

import type { Packager, PackagerInput } from "./packager.ts";
import { binOf, dropSideEffectImports, runScript, writeFiles } from "./packager.ts";

const BABEL = "@babel/core";
const TYPESCRIPT_PRESET = "@babel/preset-typescript";
const TEMPLATES = "babel-plugin-ember-template-compilation";
const DECORATORS = "@babel/plugin-proposal-decorators";
const CLASS_PROPERTIES = "@babel/plugin-transform-class-properties";
const PRIVATE_METHODS = "@babel/plugin-transform-private-methods";
const STATIC_BLOCKS = "@babel/plugin-transform-class-static-block";
const CONTENT_TAG = "content-tag";
/** Its `exports` name nothing else, so its script is found through its manifest. */
const GLINT = "@glint/ember-tsc/package.json";

/** A module the packager compiles: a component's `.gts`, or a directive's or composable's `.ts`. */
const MODULE = /\.g?ts$/;

/** The part of Babel this calls. */
interface Babel {
  transformAsync(code: string, options: object): Promise<{ code?: string | null } | null>;
}

/** The part of content-tag this calls. */
interface ContentTag {
  Preprocessor: new () => {
    process(code: string, options: { filename: string }): { code: string };
  };
}

/** A relative specifier of a module the package compiles: `./Card.gts`, `./useToggle.ts`. */
const COMPILED = /^(\.\.?\/.*)\.g?ts$/;

/** A Babel plugin that points each relative import of a compiled module at its `.js`. */
const jsSpecifiers = () => ({
  visitor: {
    "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration"(path: {
      node: { source?: { value: string } | null };
    }) {
      const source = path.node.source;
      if (source) source.value = source.value.replace(COMPILED, "$1.js");
    },
  },
});

/**
 * Each module as an app takes a v2 addon's: TypeScript stripped, each `<template>` left for the
 * app's template compiler (`precompileTemplate`, `targetFormat: "hbs"`), and the decorators
 * lowered with Babel's own helpers inline, so the package imports nothing but Ember (P7).
 */
async function compileModules({ files, out, work, resolve }: PackagerInput): Promise<void> {
  const babel: Babel = await import(/* @vite-ignore */ pathToFileURL(resolve(BABEL)).href);
  const { Preprocessor }: ContentTag = await import(
    /* @vite-ignore */ pathToFileURL(resolve(CONTENT_TAG)).href
  );
  const preprocessor = new Preprocessor();
  for (const file of files) {
    if (!MODULE.test(file.path)) continue;
    const code = file.path.endsWith(".gts")
      ? preprocessor.process(file.contents, { filename: file.path }).code
      : file.contents;
    const compiled = await babel.transformAsync(code, {
      filename: join(work, "in", file.path.replace(/\.gts$/, ".ts")),
      babelrc: false,
      configFile: false,
      presets: [[resolve(TYPESCRIPT_PRESET), { allowDeclareFields: true }]],
      plugins: [
        [resolve(TEMPLATES), { targetFormat: "hbs" }],
        [resolve(DECORATORS), { version: "legacy" }],
        // Legacy decorators need the class fields lowered after them, and with them the
        // private members and the static blocks content-tag writes, all loose alike.
        [resolve(CLASS_PROPERTIES), { loose: true }],
        [resolve(PRIVATE_METHODS), { loose: true }],
        resolve(STATIC_BLOCKS),
        jsSpecifiers,
      ],
    });
    const path = join(out, file.path.replace(MODULE, ".js"));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, compiled?.code ?? "");
  }
}

/**
 * The declarations Glint writes for the tree in `work/in`: `--noCheck`, as a declaration needs no
 * check, and the app's own Glint checks its use of them. Glint names a component's `Card.gts.d.ts`
 * where its `.js` is `Card.js`, so each moves to `Card.d.ts`, and every specifier points at `.js`.
 */
async function declarations({ out, work, resolve }: PackagerInput): Promise<void> {
  const declared = join(work, "declarations");
  await writeFile(
    join(work, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "es2024",
        lib: ["es2024", "dom", "dom.iterable"],
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
        skipLibCheck: true,
        allowImportingTsExtensions: true,
        experimentalDecorators: true,
        declaration: true,
        emitDeclarationOnly: true,
        noCheck: true,
        rootDir: "in",
        outDir: "declarations",
        types: ["ember-source/types"],
      },
      include: ["in/**/*.gts", "in/**/*.ts"],
    }),
  );
  await runScript(await binOf(resolve(GLINT), "ember-tsc"), ["-p", "tsconfig.json"], work);
  for (const entry of await readdir(declared, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".d.ts")) continue;
    const from = join(entry.parentPath, entry.name);
    const to = join(out, from.slice(declared.length + 1).replace(/\.gts\.d\.ts$/, ".d.ts"));
    const text = dropSideEffectImports(await readFile(from, "utf8")).replace(
      /(from\s+["'])(\.\.?\/[^"']*)\.g?ts(["'])/g,
      "$1$2.js$3",
    );
    await mkdir(dirname(to), { recursive: true });
    await writeFile(to, text);
  }
}

/**
 * Plan §8.4: a v2 addon. Each component and module is JavaScript whose templates the app's
 * template compiler compiles, beside Glint's declarations and the scoped sheets. The output reads
 * `import.meta.env.SSR`, which a Vite app defines.
 */
export const ember: Packager = {
  peer: [
    { name: "ember-source", range: ">=7.4 <8" },
    { name: "@glimmer/component", range: "^2.0.0" },
  ],
  needs: [
    BABEL,
    TYPESCRIPT_PRESET,
    TEMPLATES,
    DECORATORS,
    CLASS_PROPERTIES,
    PRIVATE_METHODS,
    STATIC_BLOCKS,
    CONTENT_TAG,
    GLINT,
  ],
  types: "ember-source",
  exports: { types: "./ember/index.d.ts", default: "./ember/index.js" },
  run: async (input) => {
    await writeFiles(join(input.work, "in"), input.files);
    await compileModules(input);
    await declarations(input);
    const sheets: OutputFile[] = input.files.filter((file) => !MODULE.test(file.path));
    await writeFiles(input.out, sheets);
  },
};
